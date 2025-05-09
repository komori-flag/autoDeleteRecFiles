/**
 * 配置文件
 * 集中管理所有配置参数
 */

module.exports = {
  // 定时任务配置
  cronSchedule: '0 */6 * * *', // 每6小时执行一次
  
  // 磁盘空间配置
  minFreeSpaceGB: 50, // 最小剩余空间阈值(GB)
  bufferPercentage: 10, // 缓冲百分比，释放额外空间
  
  // 文件路径配置
  recordingsPath: 'E:/Recordings', // 录制文件存储路径
  
  // 删除操作配置
  deleteDelay: 24, // 发送警告到执行删除的延迟时间(小时)
  
  // 邮件配置
  email: {
    smtp: {
      host: 'smtp.example.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: 'notifications@example.com',
        pass: 'your-password'
      }
    },
    from: 'notifications@example.com',
    to: ['admin@example.com', 'manager@example.com']
  }
};