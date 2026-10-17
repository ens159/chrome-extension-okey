chrome.action.onClicked.addListener(async () => {
  const { winId } = await chrome.storage.local.get('winId');
  if (winId) {
    try { await chrome.windows.update(winId, { focused: true }); return; } catch (e) {}
  }
  const w = await chrome.windows.create({ url: 'game.html', type: 'popup', width: 1000, height: 740 });
  await chrome.storage.local.set({ winId: w.id });
});
