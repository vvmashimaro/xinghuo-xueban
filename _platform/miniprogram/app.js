const StorageService = require('./utils/storage');

App({
  onLaunch() {
    // 启动时从统一库拉取快照；失败则本地兜底
    StorageService.ready();
    StorageService.hydrateFromServer().catch((e) => {
      console.warn('hydrate fail', e);
    });
  },
  globalData: {
    brand: '星火学伴',
    primary: '#0d9488'
  },
  storage: StorageService
});
