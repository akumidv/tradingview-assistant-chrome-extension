const helper = {}

helper.getDeepBackTestingStatus = async () => {
    const value = await storage.getKey(storage.DEEP_BACKTESTING_ENABLE);
    return value && value === 'true'
}
