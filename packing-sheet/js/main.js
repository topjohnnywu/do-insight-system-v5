/* App entry point (classic script). Mounts window.App into #root via ReactDOM. */
(function () {
  const rootEl = document.getElementById('root');
  const root = ReactDOM.createRoot(rootEl);
  root.render(React.createElement(React.StrictMode, null, React.createElement(window.App)));
})();
