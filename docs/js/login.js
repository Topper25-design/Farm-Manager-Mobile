// Setup keyboard detection for mobile devices
function setupKeyboardDetection() {
    // For iOS using visual viewport API
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            // The viewport size gets smaller when the keyboard appears
            const currentHeight = window.visualViewport.height;
            const windowHeight = window.innerHeight;
            
            if (currentHeight < windowHeight * 0.8) {
                // Keyboard is likely visible
                document.body.classList.add('keyboard-open');
                
                // Find any open popups and mark them as keyboard-visible
                document.querySelectorAll('.popup').forEach(popup => {
                    popup.classList.add('keyboard-visible');
                });
            } else {
                // Keyboard is likely hidden
                document.body.classList.remove('keyboard-open');
                
                // Remove keyboard-visible class from popups
                document.querySelectorAll('.popup').forEach(popup => {
                    popup.classList.remove('keyboard-visible');
                });
            }
        });
    }
    
    // Add explicit focus handling for input fields
    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            // On iOS, explicitly focus the element after a slight delay
            setTimeout(() => {
                e.target.focus();
            }, 100);
        }
    });
    
    // Fallback for devices without visualViewport - use focus/blur events
    document.addEventListener('focusin', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            document.body.classList.add('keyboard-open');
            
            // Find parent popup if any
            const parentPopup = e.target.closest('.popup');
            if (parentPopup) {
                parentPopup.classList.add('keyboard-visible');
            }
        }
    });
    
    document.addEventListener('focusout', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            // Small delay to prevent flashing during focus changes between inputs
            setTimeout(() => {
                if (document.activeElement.tagName !== 'INPUT' && 
                    document.activeElement.tagName !== 'TEXTAREA' && 
                    document.activeElement.tagName !== 'SELECT') {
                    document.body.classList.remove('keyboard-open');
                    
                    // Remove keyboard-visible class from popups
                    document.querySelectorAll('.popup').forEach(popup => {
                        popup.classList.remove('keyboard-visible');
                    });
                }
            }, 100);
        }
    });
    
    // Add metadata for better iOS keyboard handling
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
        // Update viewport meta to better handle iOS keyboard
        viewportMeta.setAttribute('content', 
            'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Login page loaded');
    
    // Setup keyboard detection for mobile devices
    setupKeyboardDetection();
    
    // Check if already logged in
    const isLoggedIn = await mobileStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
        console.log('Already logged in, redirecting to dashboard...');
        window.location.href = 'dashboard.html';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('error-message');
    const forgotPassword = document.getElementById('forgot-password');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Login form submitted');
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // Simple validation
        if (!username || !password) {
            errorMessage.textContent = 'Please enter both username and password';
            errorMessage.style.display = 'block';
            return;
        }

        // Show loading state
        const submitButton = loginForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.textContent = 'Logging in...';
        submitButton.disabled = true;
        
        try {
            // Simulate API call with timeout
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Hardcoded credentials for demo
            if (username === 'admin' && password === 'password123') {
                console.log('Login successful');
                await mobileStorage.setItem('isLoggedIn', 'true');
                await mobileStorage.setItem('username', username);
                window.location.href = 'dashboard.html';
            } else {
                console.log('Login failed');
                errorMessage.textContent = 'Invalid username or password';
                errorMessage.style.display = 'block';
                
                // Reset button
                submitButton.textContent = originalButtonText;
                submitButton.disabled = false;
            }
        } catch (error) {
            console.error('Login error:', error);
            errorMessage.textContent = 'An error occurred. Please try again.';
            errorMessage.style.display = 'block';
            
            // Reset button
            submitButton.textContent = originalButtonText;
            submitButton.disabled = false;
        }
    });

    forgotPassword.addEventListener('click', () => {
        // For mobile, use a native alert if available
        if (typeof navigator !== 'undefined' && navigator.notification) {
            navigator.notification.alert(
                'Password recovery functionality coming soon!',
                null,
                'Forgot Password',
                'OK'
            );
        } else {
            alert('Password recovery functionality coming soon!');
        }
    });
}); 