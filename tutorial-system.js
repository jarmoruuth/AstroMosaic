/**
 * Interactive Tutorial System
 * Highlights page elements and provides step-by-step guidance
 */

class TutorialSystem {
    constructor(steps) {
        this.steps = steps;
        this.currentStep = 0;
        this.isActive = false;
        this.elements = {};
        
        this.init();
    }
    
    init() {
        // Create tutorial elements
        this.createElements();
        
        // Add event listeners
        this.addEventListeners();
    }
    
    createElements() {
        // Create overlay
        this.elements.overlay = document.createElement('div');
        this.elements.overlay.className = 'tutorial-overlay hidden';
        document.body.appendChild(this.elements.overlay);
        
        // Create spotlight
        this.elements.spotlight = document.createElement('div');
        this.elements.spotlight.className = 'tutorial-spotlight';
        this.elements.spotlight.style.display = 'none';
        document.body.appendChild(this.elements.spotlight);
        
        // Create tooltip
        this.elements.tooltip = document.createElement('div');
        this.elements.tooltip.className = 'tutorial-tooltip';
        this.elements.tooltip.style.display = 'none';
        this.elements.tooltip.innerHTML = `
            <div class="tutorial-tooltip-header">
                <h3 class="tutorial-tooltip-title"></h3>
                <button class="tutorial-tooltip-close" aria-label="Close tutorial">&times;</button>
            </div>
            <div class="tutorial-tooltip-content"></div>
            <div class="tutorial-tooltip-footer">
                <div class="tutorial-tooltip-progress"></div>
                <div class="tutorial-tooltip-buttons">
                    <button class="tutorial-button tutorial-button-prev">Previous</button>
                    <button class="tutorial-button tutorial-button-next">Next</button>
                </div>
            </div>
        `;
        document.body.appendChild(this.elements.tooltip);
        
        // Create arrow
        this.elements.arrow = document.createElement('div');
        this.elements.arrow.className = 'tutorial-arrow';
        this.elements.arrow.style.display = 'none';
        document.body.appendChild(this.elements.arrow);
        
        // Create start button
        this.elements.startButton = document.createElement('button');
        this.elements.startButton.className = 'tutorial-start-button';
        this.elements.startButton.innerHTML = '🎓 Start Tutorial';
        document.body.appendChild(this.elements.startButton);
    }
    
    addEventListeners() {
        // Start button
        this.elements.startButton.addEventListener('click', () => this.start());
        
        // Close button
        this.elements.tooltip.querySelector('.tutorial-tooltip-close').addEventListener('click', () => this.end());
        
        // Previous button
        this.elements.tooltip.querySelector('.tutorial-button-prev').addEventListener('click', () => this.previous());
        
        // Next button
        this.elements.tooltip.querySelector('.tutorial-button-next').addEventListener('click', () => this.next());
        
        // Allow clicking on highlighted element
        this.elements.spotlight.addEventListener('click', (e) => {
            if (this.steps[this.currentStep].allowInteraction) {
                // Let the click through to the actual element
            }
        });
        
        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isActive) {
                this.end();
            }
        });
        
        // Resize handling
        window.addEventListener('resize', () => {
            if (this.isActive) {
                this.showStep(this.currentStep);
            }
        });
    }
    
    start() {
        this.isActive = true;
        this.currentStep = 0;
        this.elements.startButton.classList.add('hidden');
        this.elements.overlay.classList.remove('hidden');
        this.showStep(0);
    }
    
    end() {
        this.isActive = false;
        this.elements.overlay.classList.add('hidden');
        this.elements.spotlight.style.display = 'none';
        this.elements.tooltip.style.display = 'none';
        this.elements.arrow.style.display = 'none';
        this.elements.startButton.classList.remove('hidden');
    }
    
    next() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.showStep(this.currentStep);
        } else {
            this.end();
        }
    }
    
    previous() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showStep(this.currentStep);
        }
    }
    
    showStep(stepIndex) {
        const step = this.steps[stepIndex];
        
        // Get target element
        const targetElement = document.querySelector(step.element);
        
        if (!targetElement) {
            console.warn(`Tutorial: Element not found: ${step.element}`);
            return;
        }
        
        // Scroll element into view
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Position spotlight
        setTimeout(() => {
            const rect = targetElement.getBoundingClientRect();
            const padding = step.padding || 8;
            
            this.elements.spotlight.style.display = 'block';
            this.elements.spotlight.style.left = (rect.left - padding) + 'px';
            this.elements.spotlight.style.top = (rect.top - padding) + 'px';
            this.elements.spotlight.style.width = (rect.width + padding * 2) + 'px';
            this.elements.spotlight.style.height = (rect.height + padding * 2) + 'px';
            
            // Position tooltip
            this.positionTooltip(rect, step);
            
            // Update tooltip content
            this.updateTooltipContent(step, stepIndex);
            
            this.elements.tooltip.style.display = 'block';
        }, 300);
    }
    
    positionTooltip(targetRect, step) {
        const tooltip = this.elements.tooltip;
        const arrow = this.elements.arrow;
        
        let position = step.position || 'auto';
        
        // First, position the tooltip to get accurate dimensions
        tooltip.style.left = '0px';
        tooltip.style.top = '0px';
        tooltip.style.maxHeight = 'none';
        
        // Force a reflow to get accurate measurements
        tooltip.offsetHeight;
        const tooltipRect = tooltip.getBoundingClientRect();
        
        // Check if tooltip is taller than viewport
        const viewportHeight = window.innerHeight;
        const maxTooltipHeight = viewportHeight - 40; // 20px margin top and bottom
        
        if (tooltipRect.height > maxTooltipHeight) {
            tooltip.style.maxHeight = maxTooltipHeight + 'px';
            tooltip.style.overflowY = 'auto';
        }
        
        // Get updated dimensions after potential height adjustment
        const finalTooltipRect = tooltip.getBoundingClientRect();
        
        // Auto-position if needed
        if (position === 'auto') {
            const spaceAbove = targetRect.top;
            const spaceBelow = window.innerHeight - targetRect.bottom;
            const spaceLeft = targetRect.left;
            const spaceRight = window.innerWidth - targetRect.right;
            
            const spaces = {
                top: spaceAbove,
                bottom: spaceBelow,
                left: spaceLeft,
                right: spaceRight
            };
            
            position = Object.keys(spaces).reduce((a, b) => spaces[a] > spaces[b] ? a : b);
        }
        
        let tooltipX, tooltipY, arrowX, arrowY;
        arrow.className = 'tutorial-arrow';
        
        switch (position) {
            case 'top':
                tooltipX = targetRect.left + (targetRect.width / 2) - (finalTooltipRect.width / 2);
                tooltipY = targetRect.top - finalTooltipRect.height - 20;
                arrowX = targetRect.left + (targetRect.width / 2) - 10;
                arrowY = targetRect.top - 10;
                arrow.classList.add('arrow-top');
                break;
                
            case 'bottom':
                tooltipX = targetRect.left + (targetRect.width / 2) - (finalTooltipRect.width / 2);
                tooltipY = targetRect.bottom + 20;
                arrowX = targetRect.left + (targetRect.width / 2) - 10;
                arrowY = targetRect.bottom;
                arrow.classList.add('arrow-bottom');
                break;
                
            case 'left':
                tooltipX = targetRect.left - finalTooltipRect.width - 20;
                tooltipY = targetRect.top + (targetRect.height / 2) - (finalTooltipRect.height / 2);
                arrowX = targetRect.left - 10;
                arrowY = targetRect.top + (targetRect.height / 2) - 10;
                arrow.classList.add('arrow-left');
                break;
                
            case 'right':
                tooltipX = targetRect.right + 20;
                tooltipY = targetRect.top + (targetRect.height / 2) - (finalTooltipRect.height / 2);
                arrowX = targetRect.right;
                arrowY = targetRect.top + (targetRect.height / 2) - 10;
                arrow.classList.add('arrow-right');
                break;
        }
        
        // Keep tooltip on screen horizontally
        tooltipX = Math.max(10, Math.min(tooltipX, window.innerWidth - finalTooltipRect.width - 10));
        
        // Keep tooltip on screen vertically with better handling
        const minY = 10;
        const maxY = window.innerHeight - finalTooltipRect.height - 10;
        
        // If tooltip would go off bottom, move it up
        if (tooltipY + finalTooltipRect.height > window.innerHeight - 10) {
            tooltipY = window.innerHeight - finalTooltipRect.height - 10;
        }
        
        // If tooltip would go off top, move it down
        if (tooltipY < 10) {
            tooltipY = 10;
        }
        
        // Apply final position
        tooltip.style.left = tooltipX + 'px';
        tooltip.style.top = tooltipY + 'px';
        
        arrow.style.left = arrowX + 'px';
        arrow.style.top = arrowY + 'px';
        arrow.style.display = 'block';
    }
    
    updateTooltipContent(step, stepIndex) {
        const tooltip = this.elements.tooltip;
        
        tooltip.querySelector('.tutorial-tooltip-title').textContent = step.title;
        
        // Support HTML content if specified, otherwise treat as plain text
        const contentElement = tooltip.querySelector('.tutorial-tooltip-content');
        if (step.contentHTML) {
            contentElement.innerHTML = step.contentHTML;
        } else {
            // Convert \n to <br> for plain text content
            const formattedContent = step.content.replace(/\n/g, '<br>');
            contentElement.innerHTML = formattedContent;
        }
        
        tooltip.querySelector('.tutorial-tooltip-progress').textContent = 
            `Step ${stepIndex + 1} of ${this.steps.length}`;
        
        // Update button states
        const prevButton = tooltip.querySelector('.tutorial-button-prev');
        const nextButton = tooltip.querySelector('.tutorial-button-next');
        
        prevButton.disabled = stepIndex === 0;
        
        if (stepIndex === this.steps.length - 1) {
            nextButton.textContent = 'Finish';
        } else {
            nextButton.textContent = 'Next';
        }
    }
}

// Export for use
window.TutorialSystem = TutorialSystem;
