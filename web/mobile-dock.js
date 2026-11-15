// Menjaga aksi render mudah dijangkau di layar kecil tanpa mengubah alur render.
const exportPanel = document.querySelector('.render-section');
const mobile = window.matchMedia('(max-width: 767px)');

if (exportPanel && 'IntersectionObserver' in window) {
  let exportVisible = false;
  const applyDockState = () => {
    document.body.classList.toggle('render-dock-visible', mobile.matches && !exportVisible);
  };
  const observer = new IntersectionObserver(([entry]) => {
    exportVisible = entry.isIntersecting;
    applyDockState();
  }, {threshold: 0.08});
  observer.observe(exportPanel);
  if (typeof mobile.addEventListener === 'function') {
    mobile.addEventListener('change', applyDockState);
  } else if (typeof mobile.addListener === 'function') {
    mobile.addListener(applyDockState);
  }
}
