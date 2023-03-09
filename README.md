# About
This tool builds upon two existing Chrome Extensions for backtesting in Tradingview:

[The optimizer] https://chrome.google.com/webstore/detail/the-optimiser-tradingview/emcpjechgmpcnjphefjekmdlaljbiegp

and The
[Tradingview assistant] https://chrome.google.com/webstore/detail/tradingview-assistant/pfbdfjaonemppanfnlmliafffahlohfg

I am not certain about their history, but for the most part the codes are identical. Going over their online history, The Tradingview Assistant is older by a couple days, and has made the code open source in Github.

Unfortuntely, they both lack the functionaility to download the List of Trades of each iteraction of the optimization, which can be used for different reasons. That fucntionaility is created here. To do so, six of the original files from The Tradingview Assistant were created or modified:

From root folder:
  1. background.js
  2. manifest.json

From Content_Scripts folder:
  1. action.js
  2. backtest.js
  3. file.js
  4. tv.js

You can simply copy those files from this repository and replace them in the original extension.

To install from here:

1. Download the files from this Repository as a zip file, and unzip it in your local computer.
2. Open the Chrome Browser and type "chrome://extensions/" hit Enter
3. Delete any related extension.
4. Click on "Load unpacked" and browse to the folder you unzipped...Operate as normal...

At each interacition of the optimization, the list of trades will be saved to your local folder. The name of each iteractoin will be appended to the list of main results, so you can post-process the data provided by the assistnat with any other you can gain from the list of trades.

Please consider supporting the original developers from The optimizer and the Tradingview Assistant.
