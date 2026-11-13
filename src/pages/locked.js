// Shown in place of the browser's extensions page while hard mode is locked.
(function () {
  const line = document.getElementById('until');
  chrome.runtime.sendMessage({ type: 'get' }).then((res) => {
    const lock = res && res.effective && res.effective.lock;
    line.textContent = lock ? `Until ${HM.formatWhen(lock.until)}` : 'The lock has ended.';
  }, () => {});
})();
