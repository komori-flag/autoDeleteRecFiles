/**
 * 邮件发送模块
 * 负责发送各类通知邮件
 */

const nodemailer = require('nodemailer');
const config = require('../config');
const { handleError } = require('../utils/handleError');

/**
 * 创建邮件传输器
 */
const transporter = nodemailer.createTransport(config.email.smtp);

/**
 * 发送邮件
 * @param {string} subject - 邮件主题
 * @param {string} content - 邮件内容
 * @returns {Promise<{messageId: string}>} - 发送结果，包含messageId
 */
async function sendEmail(subject, content) {
  try {
    const mailOptions = {
      from: config.email.from,
      to: config.email.to.join(','),
      subject: subject,
      html: content
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`邮件发送成功: ${info.messageId}`);
    return info;
  } catch (error) {
    const { errMsg } = handleError(error);
    console.error(`邮件发送失败: ${errMsg}`);
    throw error;
  }
}

/**
 * 准备删除通知邮件内容
 * @param {Array<{path: string, sizeGB: number, mtime: number}>} dirsToDelete - 将要删除的目录列表
 * @param {{totalGB: number, freeGB: number, usedGB: number, usedPercentage: number}} spaceInfo - 磁盘空间信息
 * @param {number} minFreeSpaceGB - 最小剩余空间阈值
 * @param {number} deleteDelay - 删除延迟时间(小时)
 * @returns {string} - 格式化的HTML邮件内容
 */
function prepareDeleteEmail(dirsToDelete, spaceInfo, minFreeSpaceGB, deleteDelay) {
  const totalSizeToFree = dirsToDelete.reduce((total, dir) => total + dir.sizeGB, 0);
  
  let dirListHtml = '';
  dirsToDelete.forEach(dir => {
    dirListHtml += `
      <tr>
        <td>${dir.path}</td>
        <td>${dir.sizeGB.toFixed(2)} GB</td>
        <td>${new Date(dir.mtime).toLocaleString()}</td>
      </tr>
    `;
  });
  
  return `
    <h2>磁盘空间不足警告</h2>
    <p>系统检测到录制文件所在磁盘空间不足：</p>
    <ul>
      <li>当前剩余空间: <strong>${spaceInfo.freeGB.toFixed(2)} GB</strong></li>
      <li>空间阈值: <strong>${minFreeSpaceGB} GB</strong></li>
      <li>使用率: <strong>${spaceInfo.usedPercentage.toFixed(2)}%</strong></li>
    </ul>
    
    <p>系统将在 <strong>${deleteDelay} 小时</strong> 后自动删除以下最早的录制文件目录，预计释放 <strong>${totalSizeToFree.toFixed(2)} GB</strong> 空间:</p>
    
    <table border="1" cellpadding="5" style="border-collapse: collapse;">
      <tr>
        <th>目录路径</th>
        <th>大小</th>
        <th>修改时间</th>
      </tr>
      ${dirListHtml}
    </table>
    
    <p>如需保留这些文件，请在 ${deleteDelay} 小时内将其移动到其他位置。</p>
    <p>此邮件由系统自动发送，请勿回复。</p>
  `;
}

/**
 * 准备删除完成通知邮件内容
 * @param {Array<{path: string, sizeGB: number, mtime: number}>} deletedDirs - 已删除的目录列表
 * @param {{totalGB: number, freeGB: number, usedGB: number, usedPercentage: number}} spaceInfo - 当前磁盘空间信息
 * @returns {string} - 格式化的HTML邮件内容
 */
function prepareCompletionEmail(deletedDirs, spaceInfo) {
  const totalFreed = deletedDirs.reduce((total, dir) => total + dir.sizeGB, 0);
  
  let dirListHtml = '';
  deletedDirs.forEach(dir => {
    dirListHtml += `
      <tr>
        <td>${dir.path}</td>
        <td>${dir.sizeGB.toFixed(2)} GB</td>
      </tr>
    `;
  });
  
  return `
    <h2>自动删除完成通知</h2>
    <p>系统已完成自动删除操作：</p>
    <ul>
      <li>已删除目录数: <strong>${deletedDirs.length}</strong></li>
      <li>释放空间: <strong>${totalFreed.toFixed(2)} GB</strong></li>
      <li>当前剩余空间: <strong>${spaceInfo.freeGB.toFixed(2)} GB</strong></li>
      <li>当前使用率: <strong>${spaceInfo.usedPercentage.toFixed(2)}%</strong></li>
    </ul>
    
    <p>已删除的目录列表:</p>
    <table border="1" cellpadding="5" style="border-collapse: collapse;">
      <tr>
        <th>目录路径</th>
        <th>释放空间</th>
      </tr>
      ${dirListHtml}
    </table>
    
    <p>此邮件由系统自动发送，请勿回复。</p>
  `;
}

module.exports = {
  sendEmail,
  prepareDeleteEmail,
  prepareCompletionEmail
};