// WebView Detection
function isWebView() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  return (
    (ua.includes("Android") && ua.includes("wv")) ||
    (ua.includes("iPhone") && !ua.includes("Safari"))
  );
}
if (isWebView()) {
  document.getElementById('sticky-footer-ad').style.display = 'none';
}

// Close Button
document.getElementById('close-ad').onclick = (e) => {
  e.stopPropagation();
  document.getElementById('sticky-footer-ad').style.display = 'none';
};
