/**
 * 自动检测磁盘空间并删除旧录制文件
 * 功能：
 * 1. 定时检测磁盘空间
 * 2. 当剩余空间低于阈值时发送邮件警告
 * 3. 自动删除最早的录制文件目录
 */

const cron = require('node-cron');
const path = require('path');
const config = require('./config');
const diskManager = require('./lib/diskManager');
const emailSender = require('./lib/emailSender');
const fileManager = require('./lib/fileManager');
const { handleError } = require('./utils/handleError');

// 初始化配置
const {
  cronSchedule,
  minFreeSpaceGB,
  bufferPercentage,
  recordingsPaths,
  deleteDelay
} = config;

let isDeletionScheduled = false; // Flag to prevent concurrent runs

async function main() {
  if (isDeletionScheduled) {
    console.log('已有删除任务在计划中，本次检查跳过');
    return;
  }

  const results = [];
  const diskCache = new Map(); // Cache for disk space info

  for (const recordingsPath of recordingsPaths) {
    const diskRoot = path.parse(recordingsPath).root;
    let spaceInfo;

    if (diskCache.has(diskRoot)) {
      spaceInfo = diskCache.get(diskRoot);
      console.log(`使用磁盘 ${diskRoot} 的缓存空间信息进行检查: ${recordingsPath}`);
    } else {
      try {
        console.log(`首次检查磁盘 ${diskRoot} 的空间...`);
        spaceInfo = await diskManager.getDiskSpace(recordingsPath);
        diskCache.set(diskRoot, spaceInfo);
      } catch (error) {
        console.error(`检查磁盘 ${diskRoot} 空间时出错:`, handleError(error).errMsg);
        await emailSender.sendEmail(`磁盘空间检查错误 (${diskRoot})`, `检查 ${diskRoot} 磁盘空间时发生错误: ${handleError(error).errMsg}`);
        continue; // Skip to next path
      }
    }

    try {
      if (spaceInfo.freeGB < minFreeSpaceGB) {
        console.log(`警告: 路径 ${recordingsPath} 所在磁盘剩余空间 ${spaceInfo.freeGB.toFixed(2)}GB 低于阈值 ${minFreeSpaceGB}GB`);

        const dirsToDelete = await fileManager.getDirectoriesToDelete(
          recordingsPath,
          spaceInfo.freeGB,
          minFreeSpaceGB,
          bufferPercentage
        );

        results.push({ recordingsPath, spaceInfo, dirsToDelete });

        if (dirsToDelete.length > 0) {
          const totalSizeToFree = dirsToDelete.reduce((total, dir) => total + dir.sizeGB, 0);
          console.log(`${recordingsPath}: 将删除 ${dirsToDelete.length} 个目录，预计释放 ${totalSizeToFree.toFixed(2)}GB 空间`);
        } else {
          console.log(`${recordingsPath}: 空间不足，但没有找到可删除的目录`);
        }
      } else {
        console.log(`路径 ${recordingsPath} 所在磁盘空间充足，无需操作`);
      }
    } catch (error) {
      console.error(`处理路径 ${recordingsPath} 时出错:`, handleError(error).errMsg);
      await emailSender.sendEmail(`路径处理错误 (${recordingsPath})`, `处理 ${recordingsPath} 时发生错误: ${handleError(error).errMsg}`);
    }
  }

  const triggeredResults = results.filter(result => result && result.dirsToDelete.length > 0);

  if (triggeredResults.length > 0) {
    console.log(`检测到 ${triggeredResults.length} 个路径需要处理空间不足问题`);

    const dirsByDisk = new Map();
    for (const result of triggeredResults) {
      const diskRoot = path.parse(result.recordingsPath).root;
      if (!dirsByDisk.has(diskRoot)) {
        const targetFreeGB = minFreeSpaceGB * (1 + bufferPercentage / 100);
        const spaceToFreeGB = targetFreeGB - result.spaceInfo.freeGB;
        dirsByDisk.set(diskRoot, { dirs: [], spaceToFreeGB, spaceInfo: result.spaceInfo });
      }
      dirsByDisk.get(diskRoot).dirs.push(...result.dirsToDelete);
    }

    /**
     * @type {{ path: string; sizeGB: number; mtime: number; }[]}
     */
    const allDirsToDelete = [];
    for (const [diskRoot, { dirs, spaceToFreeGB }] of dirsByDisk.entries()) {
      console.log(`为磁盘 ${diskRoot} 整合删除列表...`);
      const sortedDirs = dirs.sort((/** @type {{ mtime: number; }} */ a, /** @type {{ mtime: number; }} */ b) => a.mtime - b.mtime);
      let freedSpace = 0;
      const dirsToDeleteForThisDisk = [];
      for (const dir of sortedDirs) {
        if (freedSpace < spaceToFreeGB) {
          dirsToDeleteForThisDisk.push(dir);
          freedSpace += dir.sizeGB;
        } else {
          break;
        }
      }
      console.log(`磁盘 ${diskRoot} 计划删除 ${dirsToDeleteForThisDisk.length} 个目录，释放约 ${freedSpace.toFixed(2)}GB`);
      allDirsToDelete.push(...dirsToDeleteForThisDisk);
    }

    if (allDirsToDelete.length > 0) {
      const consolidatedEmailContent = emailSender.prepareConsolidatedDeleteEmail(triggeredResults, allDirsToDelete, minFreeSpaceGB, deleteDelay);
      await emailSender.sendEmail('磁盘空间不足警告 (整合)', consolidatedEmailContent);
      console.log(`已发送整合邮件通知，将在 ${deleteDelay} 小时后执行删除操作`);

      isDeletionScheduled = true; // Set the flag
      setTimeout(async () => {
        console.log('开始执行整合删除操作...');
        const deletedDirs = await fileManager.deleteDirectories(allDirsToDelete);
        console.log('整合删除操作完成');

        const postDeletionSpaceChecks = [];
        const postDeleteDiskCache = new Map();

        for (const result of triggeredResults) {
          const diskRoot = path.parse(result.recordingsPath).root;
          let postDeleteSpaceInfo;
          if (postDeleteDiskCache.has(diskRoot)) {
            postDeleteSpaceInfo = postDeleteDiskCache.get(diskRoot);
          } else {
            postDeleteSpaceInfo = await diskManager.getDiskSpace(result.recordingsPath);
            postDeleteDiskCache.set(diskRoot, postDeleteSpaceInfo);
          }

          postDeletionSpaceChecks.push({
            path: result.recordingsPath,
            spaceInfo: postDeleteSpaceInfo
          });
        }

        const consolidatedCompletionEmailContent = emailSender.prepareConsolidatedCompletionEmail(deletedDirs, postDeletionSpaceChecks);
        await emailSender.sendEmail('自动删除完成通知 (整合)', consolidatedCompletionEmailContent);

        isDeletionScheduled = false; // Reset the flag
      }, deleteDelay * 60 * 60 * 1000); // 转换为毫秒

    } else {
      console.log('所有监控路径磁盘空间充足，无需操作');
    }
  }
}

// 启动定时任务
console.log(`启动定时任务，调度: ${cronSchedule}`);
cron.schedule(cronSchedule, main);

// 立即执行一次检查
console.log('立即执行一次磁盘空间检查...');
main();

console.log('自动删除录制文件服务已启动');