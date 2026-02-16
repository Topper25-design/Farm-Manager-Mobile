// Navigation functionality for Farm Manager Mobile
export function setupNavigation() {
    // Handle mobile navigation
    const mobileNav = document.querySelector('.mobile-nav');
    if (mobileNav) {
        // Get current page
        const currentPath = window.location.pathname;
        const currentPage = currentPath.split('/').pop() || 'index.html';
        
        // Update active state
        const links = mobileNav.querySelectorAll('a');
        links.forEach(link => {
            if (link.getAttribute('href') === currentPage) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }
} 