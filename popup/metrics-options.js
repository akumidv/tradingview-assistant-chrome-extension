// Single source of truth for metric option lists used in popup selects.
// Format: string = value & label are the same; [value, label] = different label.
const METRICS = {
  DEFAULT_OPT_PARAM: 'Total PnL',
  DEFAULT_FILTER_PARAM: 'Total trades: All',
  GROUPS: [
    {
      header: 'Overview',
      options: [
        'Max drawdown',
        'Max drawdown %',
        'Profit factor',
        'Profitable trades',
        'Total PnL',
        'Total PnL %',
      ]
    },
    {
      header: 'Returns',
      options: [
        'Commission paid: All', 'Commission paid: Long', 'Commission paid: Short',
        'Expected payoff: All', 'Expected payoff: Long', 'Expected payoff: Short',
        'Gross loss %: All', 'Gross loss %: Long', 'Gross loss %: Short',
        'Gross loss: All', 'Gross loss: Long', 'Gross loss: Short',
        'Gross profit %: All', 'Gross profit %: Long', 'Gross profit %: Short',
        'Gross profit: All', 'Gross profit: Long', 'Gross profit: Short',
        'Initial capital',
        'Net PnL %: All', 'Net PnL %: Long', 'Net PnL %: Short',
        'Net PnL: All', 'Net PnL: Long', 'Net PnL: Short',
        'Open PnL %: All', 'Open PnL: All',
        'Profit factor: All', 'Profit factor: Long', 'Profit factor: Short',
      ]
    },
    {
      header: 'Benchmarking',
      options: [
        'Buy and hold % gain: All',
        'Buy and hold PnL %: All',
        'Buy and hold PnL: All',
        'Strategy outperformance',
      ]
    },
    {
      header: 'Risk-adjusted performance',
      options: [
        'Sharpe ratio',
        'Sortino ratio',
      ]
    },
    {
      header: 'Trades analysis',
      options: [
        'Average PnL %: All', 'Average PnL %: Long', 'Average PnL %: Short',
        'Average PnL: All', 'Average PnL: Long', 'Average PnL: Short',
        'Average bars in losers: All', 'Average bars in losers: Long', 'Average bars in losers: Short',
        'Average bars in trades: All', 'Average bars in trades: Long', 'Average bars in trades: Short',
        'Average bars in winners: All', 'Average bars in winners: Long', 'Average bars in winners: Short',
        'Average loss %: All', 'Average loss %: Long', 'Average loss %: Short',
        'Average loss: All', 'Average loss: Long', 'Average loss: Short',
        'Average profit %: All', 'Average profit %: Long', 'Average profit %: Short',
        'Average profit / average loss: All', 'Average profit / average loss: Long', 'Average profit / average loss: Short',
        'Average profit: All', 'Average profit: Long', 'Average profit: Short',
        'Largest loss %: All', 'Largest loss %: Long', 'Largest loss %: Short',
        'Largest loss as % of gross loss: All', 'Largest loss as % of gross loss: Long', 'Largest loss as % of gross loss: Short',
        'Largest loss: All', 'Largest loss: Long', 'Largest loss: Short',
        'Largest profit %: All', 'Largest profit %: Long', 'Largest profit %: Short',
        'Largest profit as % of gross profit: All', 'Largest profit as % of gross profit: Long', 'Largest profit as % of gross profit: Short',
        'Largest profit: All', 'Largest profit: Long', 'Largest profit: Short',
        'Outliers P&L %: All', 'Outliers P&L %: Long', 'Outliers P&L %: Short',
        'Outliers P&L: All', 'Outliers P&L: Long', 'Outliers P&L: Short',
        'Outliers: All', 'Outliers: Long', 'Outliers: Short',
        'Percent profitable: All', 'Percent profitable: Long', 'Percent profitable: Short',
        'Total losers: All', 'Total losers: Long', 'Total losers: Short',
        'Total open trades: All', 'Total open trades: Long', 'Total open trades: Short',
        'Total trades: All', 'Total trades: Long', 'Total trades: Short',
        'Total winners: All', 'Total winners: Long', 'Total winners: Short',
      ]
    },
    {
      header: 'Run-ups',
      options: [
        'Average run-up (close-to-close) %: All',
        'Average run-up (close-to-close): All',
        'Average run-up duration (close-to-close): All',
        'Max run-up (close-to-close) %: All',
        'Max run-up (close-to-close): All',
        'Max run-up (intrabar) %: All',
        'Max run-up (intrabar): All',
        'Max run-up as % of initial capital (intrabar): All',
      ]
    },
    {
      header: 'Drawdowns',
      options: [
        'Average drawdown (close-to-close) %: All',
        'Average drawdown (close-to-close): All',
        'Average drawdown duration (close-to-close): All',
        'Max drawdown (close-to-close) %: All',
        'Max drawdown (close-to-close): All',
        'Max drawdown (intrabar) %: All',
        'Max drawdown (intrabar): All',
        'Max drawdown as % of initial capital (intrabar): All',
        'Return of max drawdown: All',
      ]
    },
    {
      header: 'Capital usage',
      options: [
        'Account size required',
        'Annualized return (CAGR): All',
        'Annualized return (CAGR): Long',
        'Annualized return (CAGR): Short',
        'Net PnL as % of largest loss: All',
        'Net PnL as % of largest loss: Long',
        'Net PnL as % of largest loss: Short',
        'Return on account size required: All',
        'Return on account size required: Long',
        'Return on account size required: Short',
        'Return on initial capital: All',
        'Return on initial capital: Long',
        'Return on initial capital: Short',
      ]
    },
    {
      header: 'Margin usage',
      options: [
        'Average margin used: All',
        'Margin calls',
        'Margin efficiency',
        'Max margin used',
      ]
    },
  ]
}

// Flat set of all valid metric values for quick lookup
METRICS.ALL_VALUES = new Set(
  METRICS.GROUPS.flatMap(g => g.options.map(o => Array.isArray(o) ? o[0] : o))
)

METRICS.isValid = (value) => METRICS.ALL_VALUES.has(value)

METRICS.populate = (selectEl) => {
  if (!selectEl) return
  selectEl.innerHTML = ''
  for (const group of METRICS.GROUPS) {
    const header = document.createElement('option')
    header.value = `${group.header}_tab`
    header.textContent = group.header
    header.disabled = true
    selectEl.appendChild(header)
    for (const opt of group.options) {
      const [value, label] = Array.isArray(opt) ? opt : [opt, opt]
      const el = document.createElement('option')
      el.value = value
      el.textContent = label
      selectEl.appendChild(el)
    }
  }
}
