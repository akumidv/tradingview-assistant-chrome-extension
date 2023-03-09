let csv_download_name = '';

chrome.runtime.onMessage.addListener((msg, sender, sendRes) => {
    if (msg.message == 'donwload_button_clicked_to_background') {
        csv_download_name = msg.download_name;
        chrome.downloads.onDeterminingFilename.addListener(downloadListener);
    }
    return true;
});

function downloadListener(downloadItem, suggest) {
    suggest({filename:csv_download_name + ".csv", conflictAction: "overwrite"});
    chrome.downloads.onDeterminingFilename.removeListener(downloadListener);
}