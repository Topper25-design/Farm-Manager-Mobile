function updateFeedStatus() {
    const feedStatusElem = document.getElementById('feed-status');
    if (!feedStatusElem) return;
    
    // Convert feedInventory from string map if needed
    let feedInventoryData;
    if (typeof feedInventory === 'string') {
        try {
            feedInventoryData = JSON.parse(feedInventory);
        } catch (e) {
            console.error('Error parsing feed inventory:', e);
            feedInventoryData = {};
        }
    } else if (feedInventory instanceof Map) {
        feedInventoryData = Object.fromEntries(feedInventory);
    } else if (typeof feedInventory === 'object') {
        feedInventoryData = feedInventory;
    } else {
        feedInventoryData = {};
    }
    
    if (Object.keys(feedInventoryData).length === 0) {
        feedStatusElem.innerHTML = '<p class="no-data">No feed in inventory</p>';
        return;
    }
    
    // Create a DIV container with flexbox layout to center items
    let content = `
        <div style="
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 15px;
            width: 100%;
            padding: 0;
            margin: 0 auto;
        ">
    `;
    
    Object.entries(feedInventoryData).forEach(([feedType, data]) => {
        // Default values if needed
        const quantity = data.quantity || 0;
        const unit = data.unit || 'kg';
        const threshold = data.threshold || 0;
        
        // Determine feed status
        const isLow = quantity <= threshold;
        const statusColor = isLow ? "#e74c3c" : "#2ecc71";
        const quantityColor = isLow ? "#e74c3c" : "#2ecc71";
        
        // Format last update text
        const lastUpdated = data.lastUpdated 
            ? `Last updated: ${new Date(data.lastUpdated).toLocaleDateString()}`
            : 'Never updated';
            
        // Format supplier text
        const supplier = data.supplier 
            ? `Supplier: ${data.supplier}`
            : 'No supplier specified';
        
        // Create each feed item with inline styles for consistency
        content += `
            <div style="
                background-color: #f8f9fa;
                border-radius: 8px;
                border-left: 4px solid ${statusColor};
                padding: 15px;
                width: 280px;
                max-width: 280px;
                margin: 0;
                display: flex;
                flex-direction: column;
                box-sizing: border-box;
            ">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                ">
                    <span style="
                        font-weight: bold;
                        color: #2c3e50;
                    ">${feedType}</span>
                    <span style="
                        font-weight: bold;
                        color: ${quantityColor};
                    ">${quantity} ${unit}</span>
                </div>
                <div style="
                    font-size: 0.9rem;
                    color: #7f8c8d;
                    line-height: 1.5;
                ">
                    Threshold: ${threshold} ${unit}<br>
                    ${supplier}<br>
                    ${lastUpdated}
                </div>
            </div>
        `;
    });
    
    content += '</div>';
    feedStatusElem.innerHTML = content;
    
    // Force re-render to fix layout issues
    const parentCard = feedStatusElem.closest('.stat-card');
    if (parentCard) {
        // Add a tiny delay to ensure DOM has updated
        setTimeout(() => {
            // Force a reflow
            parentCard.style.display = 'none';
            void parentCard.offsetHeight; // This line forces a reflow
            parentCard.style.display = '';
        }, 50);
    }
} 