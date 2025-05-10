/**
 * 自动检测磁盘空间并删除旧录制文件
 * 功能：
 * 1. 定时检测磁盘空间
 * 2. 当剩余空间低于阈值时发送邮件警告
 * 3. 自动删除最早的录制文件目录
 */

const cron = require('node-cron');
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

async function main() {
  const promises = [];
  for (const recordingsPath of recordingsPaths) {
    promises.push(checkDiskSpace(recordingsPath));
  }

  await Promise.all(promises);
}

/**
 * 主要检查流程
 */
async function checkDiskSpace(recordingsPath = '') {
  try {
    console.log(`开始检查 ${recordingsPath} 的磁盘空间...`);
    // 获取磁盘空间信息
    const spaceInfo = await diskManager.getDiskSpace(recordingsPath);
    console.log(`总空间: ${spaceInfo.totalGB.toFixed(2)}GB, 剩余空间: ${spaceInfo.freeGB.toFixed(2)}GB`);

    // 检查是否低于阈值
    if (spaceInfo.freeGB < minFreeSpaceGB) {
      console.log(`警告: 剩余空间 ${spaceInfo.freeGB.toFixed(2)}GB 低于阈值 ${minFreeSpaceGB}GB`);

      // 获取要删除的目录列表
      const dirsToDelete = await fileManager.getDirectoriesToDelete(
        recordingsPath,
        spaceInfo.freeGB,
        minFreeSpaceGB,
        bufferPercentage
      );

      if (dirsToDelete.length === 0) {
        console.log('没有找到可删除的目录');
        return;
      }

      // 计算可释放的空间
      const totalSizeToFree = dirsToDelete.reduce((total, dir) => total + dir.sizeGB, 0);
      console.log(`将删除 ${dirsToDelete.length} 个目录，预计释放 ${totalSizeToFree.toFixed(2)}GB 空间`);

      // 发送邮件通知
      const emailContent = emailSender.prepareDeleteEmail(dirsToDelete, spaceInfo, minFreeSpaceGB, deleteDelay);
      await emailSender.sendEmail('磁盘空间不足警告', emailContent);
      console.log(`已发送邮件通知，将在 ${deleteDelay} 小时后执行删除操作`);

      // 设置定时删除
      setTimeout(async () => {
        console.log('开始执行删除操作...');
        await fileManager.deleteDirectories(dirsToDelete);
        console.log('删除操作完成');

        // 重新检查空间
        const newSpaceInfo = await diskManager.getDiskSpace(recordingsPath);
        console.log(`删除后剩余空间: ${newSpaceInfo.freeGB.toFixed(2)}GB`);

        // 发送删除完成的邮件
        const completionEmailContent = emailSender.prepareCompletionEmail(dirsToDelete, newSpaceInfo);
        await emailSender.sendEmail('自动删除完成通知', completionEmailContent);
      }, deleteDelay * 60 * 60 * 1000); // 转换为毫秒
    } else {
      console.log('磁盘空间充足，无需操作');
    }
  } catch (error) {
    console.error('检查磁盘空间时出错:', handleError(error).errMsg);
    // 发送错误通知邮件
    await emailSender.sendEmail('磁盘空间检查错误', `检查磁盘空间时发生错误: ${handleError(error).errMsg}`);
  }
}

// 启动定时任务
console.log(`启动定时任务，调度: ${cronSchedule}`);
cron.schedule(cronSchedule, main);

// 立即执行一次检查
console.log('立即执行一次磁盘空间检查...');
main();

console.log('自动删除录制文件服务已启动');