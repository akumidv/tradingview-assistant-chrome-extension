# About
Chrome extension as an assistant for working with parameters of indicators and strategies in Tradingview

## Functionality

### Upload external signals to tradingview chart

Loading external buy or sell signals by timestamps from a CSV file**

### Optimization of the parameters of the tradingview strategy:

* generating a CSV** template for setting a range of parameters and their step for the current strategy
* loading a range of parameters from CSV file**
* running up to 1000 cycles of randomly selecting values from a range and getting the results of the strategy
* saving all strategy results and parameters to a CSV file**

It is planned to implement the annealing method to optimize the parameters.

## Setup
Click on the browser's address bar, insert `chrome://extensions` and follow this link. Click on the "Developer mode" switch.

The "Load unpacked" button should appear. Click on it, and in the window that opens, select the folder with the saved
repository files (you can download them as a zip archive via the
link https://github.com/akumidv/tradingview-assistant-chrome-extension/archive/refs/heads/main.zip).

The `manifest.json` file is located in the root folder of the extension.

### Update
Unpack the new version to the same directory as the previous version (it is better to delete the files of the previous version).
Go to the extensions tab by following the link `chrome://extensions`. Click the restart button for the extension.


## TODO
For implementation:
- getting parameters from lists and logical parameters
- implementation of automatically detect  parameters of the float type
- implementation of the selection of optimization strategies (currently only random selection)
- selection of a parameter for optimization from the list in the strategy
- selection of the optimization direction - decrease or increase of the parameter
- display of the best results

## PS
** The field separator for CSV files is a comma.