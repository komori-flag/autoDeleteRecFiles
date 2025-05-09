/**
 * 文件管理模块
 * 负责扫描、计算和删除录制文件
 */

const fs = require('fs-extra');
const path = require('path');
const { handleError } = require('../utils/handleError');

/**
 * 获取目录大小
 * @param {string} dirPath - 目录路径
 * @returns {Promise<number>} - 目录大小(字节)
 */
async function getDirSize(dirPath) {
  try {
    const stats = await fs.stat(dirPath);
    
    if (!stats.isDirectory()) {
      return stats.size;
    }
    
    const files = await fs.readdir(dirPath);
    const pathPromises = files.map(file => {
      const filePath = path.join(dirPath, file);
      return getDirSize(filePath);
    });
    
    const sizes = await Promise.all(pathPromises);
    return sizes.reduce((total, size) => total + size, 0);
  } catch (error) {
    console.error(`获取目录大小失败: ${handleError(error).errMsg}`);
    return 0; // 如果目录不存在或无法访问，返回0
  }
}

/**
 * 扫描目录并获取子目录信息
 * @param {string} dirPath - 要扫描的目录路径
 * @returns {Promise<Array<{path: string, sizeGB: number, mtime: number}>>} - 子目录信息数组，包含路径、大小和修改时间
 */
async function scanDirectories(dirPath) {
  try {
    // 确保目录存在
    if (!await fs.pathExists(dirPath)) {
      console.error(`目录不存在: ${dirPath}`);
      return [];
    }
    
    // 读取目录内容
    const items = await fs.readdir(dirPath);
    const dirInfoPromises = [];
    
    // 过滤出子目录
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isDirectory()) {
        // 计算目录大小
        const sizeBytes = await getDirSize(itemPath);
        const sizeGB = sizeBytes / (1024 * 1024 * 1024); // 转换为GB
        
        dirInfoPromises.push({
          path: itemPath,
          sizeGB: sizeGB,
          mtime: stats.mtime.getTime() // 获取修改时间的时间戳
        });
      }
    }
    
    // 按修改时间排序（最早的在前）
    return dirInfoPromises.sort((a, b) => a.mtime - b.mtime);
  } catch (error) {
    console.error(`扫描目录失败: ${handleError(error).errMsg}`);
    return [];
  }
}

/**
 * 获取需要删除的目录列表
 * @param {string} recordingsPath - 录制文件根目录
 * @param {number} currentFreeGB - 当前剩余空间(GB)
 * @param {number} minFreeSpaceGB - 最小剩余空间阈值(GB)
 * @param {number} bufferPercentage - 缓冲百分比
 * @returns {Promise<Array<{path: string, sizeGB: number, mtime: number}>} - 需要删除的目录列表
 */
async function getDirectoriesToDelete(recordingsPath, currentFreeGB, minFreeSpaceGB, bufferPercentage) {
  try {
    // 计算需要释放的空间
    const targetFreeGB = minFreeSpaceGB * (1 + bufferPercentage / 100);
    const spaceToFreeGB = targetFreeGB - currentFreeGB;
    
    // 如果不需要释放空间，返回空数组
    if (spaceToFreeGB <= 0) {
      return [];
    }
    
    console.log(`需要释放 ${spaceToFreeGB.toFixed(2)}GB 空间以达到目标剩余空间 ${targetFreeGB.toFixed(2)}GB`);
    
    // 获取所有子目录信息
    const allDirs = await scanDirectories(recordingsPath);
    
    if (allDirs.length === 0) {
      console.log('没有找到可删除的目录');
      return [];
    }
    
    // 按修改时间排序（最早的在前）
    const sortedDirs = allDirs.sort((a, b) => a.mtime - b.mtime);
    
    // 选择要删除的目录
    const dirsToDelete = [];
    let totalSizeToFree = 0;
    
    for (const dir of sortedDirs) {
      dirsToDelete.push(dir);
      totalSizeToFree += dir.sizeGB;
      
      // 如果已经达到目标释放空间，停止添加
      if (totalSizeToFree >= spaceToFreeGB) {
        break;
      }
    }
    
    return dirsToDelete;
  } catch (error) {
    console.error(`获取要删除的目录列表失败: ${handleError(error).errMsg}`);
    return [];
  }
}

/**
 * 删除指定的目录列表
 * @param {Array<{path: string, sizeGB: number, mtime: number}>} directories - 要删除的目录列表
 * @returns {Promise<Array<{path: string, sizeGB: number, mtime: number}>} - 成功删除的目录列表
 */
async function deleteDirectories(directories) {
  const deletedDirs = [];
  
  for (const dir of directories) {
    try {
      console.log(`删除目录: ${dir.path}`);
      await fs.remove(dir.path);
      deletedDirs.push(dir);
    } catch (error) {
      console.error(`删除目录失败 ${dir.path}: ${handleError(error).errMsg}`);
    }
  }
  
  return deletedDirs;
}

module.exports = {
  scanDirectories,
  getDirectoriesToDelete,
  deleteDirectories
};