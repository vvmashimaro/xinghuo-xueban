const StorageService = require('./utils/storage');

App({
  onLaunch() {
    // 启动时从统一库拉取快照；失败则本地兜底（已登录时同步服务端数据，登录页负责自动进入工作台）
    StorageService.ready();
    if (StorageService.isLoggedIn()) {
      StorageService.hydrateFromServer().catch((e) => {
        console.warn('hydrate fail', e);
      });
    } else {
      StorageService.seedIfEmptyLocal();
    }
  },
  globalData: {
    brand: '星火学伴',
    primary: '#0d9488'
  },
  storage: StorageService
});
