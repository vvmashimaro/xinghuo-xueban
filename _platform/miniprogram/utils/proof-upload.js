'use strict';

const config = require('./config.js');

const KEYS = { authToken: 'xh_auth_token_v1' };

function readToken() {
  try {
    return wx.getStorageSync(KEYS.authToken) || '';
  } catch (e) {
    return '';
  }
}

function formatSize(bytes) {
  return ((Number(bytes) || 0) / (1024 * 1024)).toFixed(1) + 'MB';
}

function apiBase() {
  return String((config && config.API_BASE) || '').replace(/\/$/, '');
}

function uploadTempFile(tempFilePath, meta) {
  const tag = (meta && meta.tag) || '佐证材料';
  const originalName = (meta && meta.name) || '';
  const token = readToken();
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: apiBase() + '/api/uploads/proof',
      filePath: tempFilePath,
      name: 'file',
      formData: {
        tag,
        originalName
      },
      header: token ? { Authorization: 'Bearer ' + token } : {},
      success(res) {
        let body = res.data;
        if (typeof body === 'string') {
          try {
            body = JSON.parse(body);
          } catch (e) {
            reject(new Error('上传响应解析失败'));
            return;
          }
        }
        if (res.statusCode === 401) {
          reject(new Error('请先登录后再上传证明材料'));
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const msg = (body && (body.error || body.message)) || `上传失败（${res.statusCode}）`;
          reject(new Error(msg));
          return;
        }
        const file = body && body.file;
        if (!file || !file.url) {
          reject(new Error('服务器未返回文件地址'));
          return;
        }
        resolve(file);
      },
      fail(err) {
        reject(err || new Error('网络上传失败'));
      }
    });
  });
}

function uploadPickedFiles(files, tag) {
  const list = files || [];
  if (!list.length) return Promise.resolve([]);
  const chain = list.reduce((promise, item) => {
    return promise.then((acc) => {
      return uploadTempFile(item.path, { tag, name: item.name }).then((record) => {
        acc.push(record);
        return acc;
      });
    });
  }, Promise.resolve([]));
  return chain;
}

function chooseFromChat(count, extension) {
  return new Promise((resolve, reject) => {
    if (!wx.chooseMessageFile) {
      reject(new Error('当前基础库不支持文件选择'));
      return;
    }
    wx.chooseMessageFile({
      count: count || 5,
      type: 'file',
      extension: extension || ['jpg', 'jpeg', 'png', 'pdf'],
      success(res) {
        const picked = (res.tempFiles || []).map((f) => ({
          path: f.path,
          name: f.name,
          size: f.size
        }));
        resolve(picked);
      },
      fail(err) {
        if (err && err.errMsg && err.errMsg.indexOf('cancel') >= 0) {
          resolve([]);
          return;
        }
        reject(err || new Error('选择文件失败'));
      }
    });
  });
}

function chooseFromAlbum(count) {
  return new Promise((resolve, reject) => {
    if (!wx.chooseMedia) {
      reject(new Error('当前基础库不支持相册选择'));
      return;
    }
    wx.chooseMedia({
      count: count || 9,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        const picked = (res.tempFiles || []).map((f, idx) => ({
          path: f.tempFilePath,
          name: `相册图片_${Date.now()}_${idx + 1}.jpg`,
          size: f.size
        }));
        resolve(picked);
      },
      fail(err) {
        if (err && err.errMsg && err.errMsg.indexOf('cancel') >= 0) {
          resolve([]);
          return;
        }
        reject(err || new Error('选择图片失败'));
      }
    });
  });
}

/**
 * 微信原生：聊天文件 / 相册拍照 / 本机文件（chooseMessageFile）
 */
function pickProofFiles(options) {
  const opts = options || {};
  const tag = opts.tag || '佐证材料';
  const count = opts.count || 5;

  return new Promise((resolve, reject) => {
    wx.showActionSheet({
      itemList: ['微信聊天文件', '相册或拍照', '本机文件'],
      success(sheet) {
        const idx = sheet.tapIndex;
        let picker;
        if (idx === 0) picker = chooseFromChat(count);
        else if (idx === 1) picker = chooseFromAlbum(count);
        else picker = chooseFromChat(count);
        picker
          .then((picked) => uploadPickedFiles(picked, tag))
          .then(resolve)
          .catch(reject);
      },
      fail(err) {
        if (err && err.errMsg && err.errMsg.indexOf('cancel') >= 0) {
          resolve([]);
          return;
        }
        reject(err || new Error('无法打开选择菜单'));
      }
    });
  });
}

module.exports = {
  pickProofFiles,
  uploadTempFile,
  formatSize
};
