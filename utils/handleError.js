/**
 * 处理错误信息
 * @param {unknown} error 错误对象
 * @returns {{ msg: string, stack: string, errMsg: string }}
 */
const handleError = (error) => {
    let msg = '';
    let stack = '';
    let errMsg = '';

    if (error instanceof Error) {
        msg = error.message;
        stack = String(error.stack);
        errMsg = stack ? `${msg}\n${stack}` : msg;
    } else {
        msg = String(error);
        errMsg = msg;
    }

    return { msg, stack, errMsg };
}

exports.handleError = handleError;