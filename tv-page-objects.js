function loadProps(obj, search, name = '', level = 0) {
  const newLevel = level + 1
  if (newLevel > 15) return
  for (let p of Object.keys(obj)) {
        if (false && p.toLowerCase().includes('alert'))
            console.log(`${name}${name ? '.' : ''}${p}`)
        else if (typeof search === 'string' && typeof obj[p] === 'string' && obj[p].toLowerCase().includes(search.toLowerCase()))
			    console.log('!!!', `${name}${name ? '.' : ''}${p}`, obj[p])
        else if (typeof search === 'number' && obj[p] === search)
          console.log('!!!', `${name}${name ? '.' : ''}${p}`, obj[p])
        if (!['window','parent', 'self','_tv_languages', 'frames', 'top', 'loginStateChange'].includes(p) && !p.includes('jQuery') && obj[p])
          loadProps(obj[p], search,`${name}${name ? '.' : ''}${p}`, newLevel);
    }
}



// KEYS only
function loadProps(obj, search, name = '', level = 0) {
  const newLevel = level + 1
  if (newLevel > 10) return
  for (let p of Object.keys(obj)) {
    if (typeof search === 'string' && typeof obj[p] === 'string' && obj[p].toLowerCase().includes(search.toLowerCase()))
      console.log('!!!', `${name}${name ? '.' : ''}${p}`, obj[p])

    if (!['window','parent', 'self','_tv_languages', 'frames', 'top', 'loginStateChange'].includes(p) && !p.includes('jQuery') && obj[p])
      loadProps(obj[p], search,`${name}${name ? '.' : ''}${p}`, newLevel);
  }
}
loadProps(window, 'stp.');




// ALERTS
// TradingView.bottomWidgetBar._options.chartWidgetCollection.activeChartWidget._value._model.m_model._alertsList._observableCollection.models

// _exposed_chartWidgetCollection.activeChartWidget._value._model.m_model._alertsList._observableCollection.models
// TradingView.Linking._activeChartWidget._model.m_model._alertsList.models


// Indicators
// TradingView.bottomWidgetBar._widgets.backtesting._reportWidgetsSet.model.m_model.m_mainSeries.m_priceScale.m_dataSources[1]._metaInfo


//TradingView.bottomWidgetBar._widgets.backtesting._reportWidgetsSets.0.model.m_model._selection._items.0._metaInfo.inputs.3.name PSAR HTF Filter Time Frame
// TradingView.bottomWidgetBar._widgets.backtesting._reportWidgetsSet.model.m_model._sessions._model._alertsList._observableCollection.models.12.attributes.description PSAR HTF Trend changed to LONGS
// TradingView.bottomWidgetBar._widgets.backtesting._reportWidgetsSet.model.m_model._panes.0.m_dataSources.1._metaInfo.inputs
//TradingView.bottomWidgetBar._widgets.backtesting._reportWidgetsSets.0.model.m_model._selection._items.0._metaInfo.inputs

// TradingView.bottomWidgetBar._widgets.backtesting._reportWidgetsSet.model.m_model._selection._dataSourcesCache.0._metaInfo
// TradingView.bottomWidgetBar._widgets.backtesting._reportWidgetsSet.model.m_model.m_mainSeries.m_priceScale.m_dataSources

// TradingView.bottomWidgetBar._widgets.backtesting._reportWidgetsSet.reportWidget._strategy.m_priceScale.m_dataSources.1._metaInfo.inputs
// TradingView.bottomWidgetBar._widgets.backtesting._reportWidgetsSet.model.m_model.m_mainSeries.m_priceScale._priceDataSources
// TradingView.bottomWidgetBar._widgets.backtesting._reportWidgetsSets.0.reportWidget._strategy.m_priceScale.m_dataSources.1._metaInfo.inputs

// Strategies
// TradingView.bottomWidgetBar._widgets.backtesting._reportWidgetsSet.model.m_model._strategySources.0