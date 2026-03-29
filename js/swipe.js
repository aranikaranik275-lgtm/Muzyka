/**
 * Swipe card gesture handler
 * Emits custom events: swipe-right (like), swipe-left (reject)
 */
export function initSwipe(cardEl, { onLike, onReject }) {
  let startX = 0, startY = 0, curX = 0, isDragging = false;
  const THRESHOLD = 80;

  function onPointerDown(e) {
    isDragging = true;
    startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    curX = 0;
    cardEl.classList.add('is-swiping');
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    const x = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const y = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    curX = x - startX;
    const curY = y - startY;

    // Prevent vertical scroll hijack when mostly horizontal
    if (Math.abs(curX) > Math.abs(curY)) {
      e.preventDefault();
    }

    const rotate = curX * 0.08;
    cardEl.style.transform = `translateX(${curX}px) rotate(${rotate}deg)`;

    cardEl.classList.toggle('like-indicator', curX > THRESHOLD * 0.5);
    cardEl.classList.toggle('nope-indicator', curX < -THRESHOLD * 0.5);
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    cardEl.classList.remove('is-swiping', 'like-indicator', 'nope-indicator');

    if (curX > THRESHOLD) {
      triggerLike();
    } else if (curX < -THRESHOLD) {
      triggerReject();
    } else {
      // Snap back
      cardEl.style.transform = '';
    }
    curX = 0;
  }

  function triggerLike() {
    cardEl.classList.add('swipe-right');
    cardEl.style.transform = '';
    setTimeout(() => {
      cardEl.classList.remove('swipe-right');
      onLike && onLike();
    }, 300);
  }

  function triggerReject() {
    cardEl.classList.add('swipe-left');
    cardEl.style.transform = '';
    setTimeout(() => {
      cardEl.classList.remove('swipe-left');
      onReject && onReject();
    }, 300);
  }

  cardEl.addEventListener('mousedown', onPointerDown);
  cardEl.addEventListener('touchstart', onPointerDown, { passive: true });
  document.addEventListener('mousemove', onPointerMove);
  document.addEventListener('touchmove', onPointerMove, { passive: false });
  document.addEventListener('mouseup', onPointerUp);
  document.addEventListener('touchend', onPointerUp);

  // Expose programmatic trigger
  return { triggerLike, triggerReject };
}
