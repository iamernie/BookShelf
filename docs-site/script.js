// Theme toggle functionality
const themeToggle = document.getElementById('theme-toggle');
const html = document.documentElement;
const body = document.body;

// Check for saved theme preference or default to 'light'
const currentTheme = localStorage.getItem('theme') || 'light';
body.classList.remove('light', 'dark');
body.classList.add(currentTheme);
updateThemeIcon(currentTheme);

themeToggle.addEventListener('click', () => {
    const currentTheme = body.classList.contains('dark') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    body.classList.remove('light', 'dark');
    body.classList.add(newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
});

function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('i');
    if (theme === 'dark') {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

// Mobile menu toggle
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const mobileMenu = document.getElementById('mobile-menu');

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
        mobileMenu.classList.toggle('show');
        const icon = mobileMenuToggle.querySelector('i');
        if (mobileMenu.classList.contains('show')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });
}

// Copy code to clipboard
const copyButtons = document.querySelectorAll('.copy-btn');

copyButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetId = button.getAttribute('data-clipboard');
        const codeElement = document.getElementById(targetId);
        const code = codeElement.textContent;
        
        navigator.clipboard.writeText(code).then(() => {
            const icon = button.querySelector('i');
            icon.classList.remove('fa-copy');
            icon.classList.add('fa-check');
            
            setTimeout(() => {
                icon.classList.remove('fa-check');
                icon.classList.add('fa-copy');
            }, 2000);
        });
    });
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Accordion functionality
document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
        const item = header.parentElement;
        const wasActive = item.classList.contains('active');

        // Close all accordion items in the same accordion
        const accordion = item.parentElement;
        accordion.querySelectorAll('.accordion-item').forEach(i => {
            i.classList.remove('active');
        });

        // Toggle the clicked item
        if (!wasActive) {
            item.classList.add('active');
        }
    });
});
