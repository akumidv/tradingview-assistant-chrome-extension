# About
An assistant for backtesting trading strategies and checking (showing) external signals in Tradingview implemented as a Chrome browser extension.

Add to Chrome from [webstore](https://chrome.google.com/webstore/detail/tradingview-assistant/pfbdfjaonemppanfnlmliafffahlohfg)

[Watch the youtube video](https://youtu.be/xhnlSCIlEkw)

Video [how to install extension](https://www.youtube.com/watch?v=FH7dI4K8w5k)

## Disclaimer
**Attention!** 

Active use of the extension can cause detection by the TradingView as using a bot for backtesting and lead to the ban of the user's account.

Although the extension is not a bot (i.e. it does not work independently of the user in the cloud). And main idea of 
this extension to help Tradingview community to have tools and functionality that not provided by Tradingview itself. 
And one of the goal of extension developing have no intention to break Tradingview rules, so extension does not 
call the TradingView API, does not interfere with data transmission, and doesn't (and won't) parse/save/send any marker 
data(charts/news) and other financial information, but only automates user behavior through the UI and provide some
additional information. 

But usage of extensions and all risks remain with the users.

The Tradingview support mention this rule for banned users

> TradingView is dedicated to providing users with a secure and accessible platform for the display of market data, 
> charts, news, and other financial information. As such, users are strictly prohibited from employing any automated 
> data collection methods, including but not limited to scripts, APIs, screen scraping, data mining, robots, or other 
> data gathering and extraction tools, regardless of their intended purposes. The use of any technology to circumvent 
> protective mechanisms designed to prevent unauthorized reproduction or distribution of TradingView content is 
> expressly forbidden."


Most cases of banned users are due to the use of extensions for a long time on a few browsers/tabs with a single account and IP.

It is important to note that any changes to strategy parameters require a request to the Tradingview servers, and this
costs money. They have an obligation to their data providers and won't risk violating this agreement and of course won't 
provide services at a loss.

To estimate how much your backtesting optimization cost for Tradingview you can use as basis of price
for 1 second of backtesting $0.0001 (AWS Lambda cost fo 5GB-sec). So 10 seconds strategy backtesting calculation with 
1000 requests will demand servers for $1. If you are doing this everyday - it will cost $20 a month. Of course if you 
are using free account, Essential($12 a month) or Plus ($24 a month) - you will generate lost for Tradingview and they 
won't like this. If you backtest all night for 10_000 requests every day, then you high-load Tradingview servers for 
$300 a month or more.

In that case if you have real good strategy it may be good idea to convert it to Python and test it
on your own servers (and it will be in 10-100 times faster)

If your trading strategy is not good the brute force for millions of combinations will not help. 

So be carefully and use extension wisely. 


**Disclaimer** 

The developer of the extension does not response for any possible consequences of its use.

## Recommendations

Keep in mind the general rule: the more parameters a trading strategy has and the more precisely they are selected, the 
better the strategy will be tuned to a specific market situation. In this case, it's not really a trading strategy 
anymore, but rather a filter.

The key recommendation is to focus on the 2-3 most significant parameters that have the most impact on result. These 
are the parameters that are important for optimizing your strategy  (correlated with profit). Instead of looking for 
the absolute best parameters, look for those that produce an acceptable result across a wide range of market conditions 
(for example, parameters that work well for multiple instruments and timeframes).

If the strategy generates more revenue than the buy-and-hold strategy on the broad market (S&P for example, alfa), on 
different instruments and timeframes, during different periods of deep testing, then it is possible that this strategy 
could be a good one. However, if the strategy generates more than twice the alfa income, it would be wise to understand 
why this is the case. Most often, this is due to the higher risk (beta) associated with the strategy, as well as the 
historical fit, meaning that it may not work as well in the future.

## Last version changes
2.10.x > 2.11.x:
- fox for splitting of Performance summary to three tabs.

## Functionality

### Backtesting trading strategies, optimisation of the strategy's parameters:

![](docs/Screenshot1.png)

* automatic getting a list of parameters and their types (numeric, lists and checkboxes are supported)
* generation of the testing range according to the rule: the beginning value is 2 times less than the current one, the end is 2 times more than the current one.
* saving the generated parameters of testing a trading strategy for their correction as a template in a file in CSV format
* Loading adjusted parameter ranges from a CSV file
* Configuring the optimisation model:
    * Choosing the type of optimisation: searching for the maximum or minimum values
    * Selecting an optimised value from the entire list of strategy results in Tradingview (Net Profit, Ratio Avg Win / Avg Loss, Sharpe Ratio, Sortino Ratio, etc.)
    * Choosing a search strategy in the parameter space(random, sequential, annealing method)
* Filtering of unsuitable results. For example, the number of tradings is less than necessary
* Setting the number of cycles to search for parameters.
* Performing automatic selection of parameters with storing all the results in the browser storage and the ability to save them as CSV files after testing, including in case of an error or page reloading
* Showing backtesting results on 3d chartto analyze the effect of various parameters on the result.
![](docs/Screenshot3.png)

#### Optimization Methods
The **sequential improvements** optimization method is implement adjusting the best value already found. It does not perform a complete search of the entire parameter space.
The logic of it work is as follows. The current best state (parameters for max results) is taken. The first parameter is taken and all its values in the range are checked sequentially. If the best result is found, then further verification is carried out from this state. Then the next parameter is taken and all its values in the range are checked and etc.

The **brute force** optimization method implement backtesting all values in strategy space of parameters.

The **annealing** method is an optimization method in which the search for the maximum possible result is carried out in fewer steps https://en.wikipedia.org/wiki/Simulated_annealing
The method works this way: first, the best state and its parameters are determined. One parameter is randomly determined, then its value from range of possible values is randomly selected. The status in this value is checked. If it is better, then it is remembered and further parameter changes are made from it.
As the number of tests increases, the spread of parameter values decreases around those already found. That is, if at the beginning of testing the values are randomly selected from the entire range of possible parameter values, then as optimization is carried out, this spread decreases ("cools down") near current values. So in first phase of test - this method is search the most possible state around all space on the finish stage this method trying to improve found best state.
So that the system does not get stuck in one parameter area, as it happens with the sequential method, not one random parameter changes periodically, but all at once.

The **random improvements** method is the simplest. One parameter is randomly determined and then a value is randomly selected for it from the entire range of possible values. If the condition is better, then it is remembered. And then the parameters from this state are randomly changed.

The **random** method - always selects random values for all parameters at once (default)


### Upload external signals to tradingview chart

Loading external buy or sell signals by timestamps from a CSV file*

![](docs/Screenshot2.png)

To display the signals, you need to create a pine script named 'iondvSignals' from the script bellow add it to the chart:
```
//©akumidv
//@version=4
study("iondv Signals", shorttitle="iondvSignals", overlay=true)
strTSBuy = input("", "TSBuy")
strTSBuy = input("", "TSSell")
tickerName = input("", "Ticker")
var arrTSBuy = str.split(buy_series_time, ",")
var arrTSSell = str.split(sell_series_time, ",")
plotchar(tickerName == syminfo.ticker and array.includes(arrTSBuy, tostring(time)) ? low : na, location = location.belowbar, color=color.green, char='▲')
plotchar(tickerName == syminfo.ticker and array.includes(arrTSSell, tostring(time)) ? low : na, location = location.abovebar, color=color.red, char='▼')
```

After that, upload the signals from the file created accordingly the template
```CSV
timestamp,ticker,timeframe,signal
1625718600000,BTCUSDT,1m,BUY
2021-07-27T01:00:00Z,BABA,1H,SELL
```

The signals are stored in the browser, to activate them, open the properties of the created indicator named 'iondvSignals'.

#### PS
** The field separator for CSV files is a comma.

## Browser configuration
If Chrome tab that have your backtest running is not active or minimized the backtest will stop working till the tab is active again.
To avoid this :
* Main Menu > More tools > Perfomance > Always keep these sites active > Add Button (Add TV domain)
* Close all other tabs (except TV) > goto [chrome://discards/](chrome://discards/) > Find TV Tab(s) > Toggle Auto Discardable from ✔ to ❌


## Setup

Install from [Chrome webstore](https://chromewebstore.google.com/detail/tradingview-assistant/pfbdfjaonemppanfnlmliafffahlohfg)

Or manually add the latest version to chrome based browser from this repository by following the instruction below.

Click on the browser's address bar, insert `chrome://extensions` and follow this link. Click on the "Developer mode" switch.

The "Load unpacked" button should appear. Click on it, and in the window that opens, select the folder with the saved
repository files (you can download them as a zip archive via the
link https://github.com/akumidv/tradingview-assistant-chrome-extension/archive/refs/heads/main.zip).

The `manifest.json` file is located in the root folder of the extension.

### Update
Unpack the new version to the same directory as the previous version (it is better to delete the files of the previous version).
Go to the extensions tab by following the link `chrome://extensions`. Click the restart button for the extension.

### Issues
Please add issues in this repository by following [link](https://github.com/akumidv/tradingview-assistant-chrome-extension/issues).

Very helpfull will be if you can attach full screenshot with tradingview page and errors. And also with open command tab in browser developer mode (please press F12 to open developer mode and click on console tab)


## **Recommendation**

If your strategy requires a large amount of testing, it is recommended to order its conversion into python and perform 
backtesting and hyperoptimization of parameters using resources, such as Google Collab or your computer. In addition, it significantly speeds up the search for parameters (in 5-10 times per cycle) and history deep. Examples in Jupyter Notebooks in repository [trade-strategies-backtesting-optimization](https://github.com/akumidv/trade-strategies-backtesting-optimization). You can run examples in Google Collab, it's free. You would just upload files  with extension `*.ipynb` to your Google Drive and open these files.

Where transfering from TradingViews scripts usually developer should solve some promblems:
* Trading view indicators – some of them have different formulas to calculate results, for example supertrend, ta.RMA and more others. They need additional implementation and in results they calculated more slowly than if python script would use `ta-lib`.
* Implementation of the data parsing. If the data for the crypt is mostly free, but the data of low timeframes is usually paid (for example, eodhistoricaldata). Developer need to implement an interface to them and some process to store and reuse local(cloud) stored data.
- Difference in data for stock or forex exchanges from Tradingview. Also, for some cryptocurrency exchanges.
- Adopt framework of backtesting (backtesting, backtrader, vectorbot, etc.) to work with strategy
- Wrap this code for frameworks of parameter gyperspace optimization (simple example you can see in [trade-strategies-backtesting-optimization](https://github.com/akumidv/trade-strategies-backtesting-optimization)) and increase speed of backtesting with some methods.


From my experience it demands 2-3 minutes developer time for each row of tradingview script. For example if you have 200 line strategy it would demand ~6 hours to conversion. For some complicated strategies it can demand much more.

To reduce developing time you can use some my repositories: 
* [tradingview-ta-lib](https://github.com/akumidv/tradingview-ta-lib) - Tradingview `ta` lib implementation in python (only for tradingview indecators that have different caclulatoin results with `ta-lib` or `python-ta` - early developing stage.
* [catcher-bot](https://github.com/akumidv/catcher-bot) - Bot for screening all symbols on excahnges/exchanges and cath trade signals - early developing stage.

## Contacts

akumidv `[at]` yahoo.com  (Do not send errors to email please, use [github issues](https://github.com/akumidv/tradingview-assistant-chrome-extension/issues) for them)

https://linkedin.com/in/akuminov

Email is preferred way, but usually I do not have the ability to answer quickly (2-3 days delay).
