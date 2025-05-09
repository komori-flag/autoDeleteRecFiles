/**
 * 磁盘管理模块
 * 负责检测磁盘空间使用情况
 */

const checkDiskSpace = require('check-disk-space').default;
const path = require('path');
const { handleError } = require('../utils/handleError');

/**
 * 获取指定路径所在磁盘的空间信息
 * @param {string} dirPath - 目录路径
 * @returns {Promise<{totalGB: number, freeGB: number, usedGB: number, usedPercentage: number}>} - 包含总空间和剩余空间的对象(GB)
 */
async function getDiskSpace(dirPath) {
  try {
    // 在Windows上，需要获取驱动器根目录
    const rootPath = path.parse(dirPath).root;
    
    // 获取磁盘使用情况
    const info = await checkDiskSpace(rootPath);
    
    // 转换为GB并返回
    return {
      totalGB: info.size / (1024 * 1024 * 1024),
      freeGB: info.free / (1024 * 1024 * 1024),
      usedGB: (info.size - info.free) / (1024 * 1024 * 1024),
      usedPercentage: ((info.size - info.free) / info.size) * 100
    };
  } catch (error) {
    console.error(`获取磁盘空间信息失败: ${handleError(error).errMsg}`);
    throw error;
  }
}

module.exports = {
  getDiskSpace
};