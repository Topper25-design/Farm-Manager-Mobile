// Function to update financial stats
function updateFinancialStats() {
    const stats = {
        totalRevenue: 0,
        totalExpenses: 0,
        netIncome: 0,
        pendingPayments: 0
    };

    // Calculate from transactions
    transactions.forEach(transaction => {
        if (transaction.type === 'income') {
            stats.totalRevenue += transaction.amount;
        } else if (transaction.type === 'expense') {
            stats.totalExpenses += transaction.amount;
        }
    });

    // Calculate from invoices
    invoices.forEach(invoice => {
        if (invoice.status === 'pending') {
            stats.pendingPayments += invoice.total;
        }
    });

    stats.netIncome = stats.totalRevenue - stats.totalExpenses;

    // Update UI
    document.getElementById('totalRevenue').textContent = `$${stats.totalRevenue.toFixed(2)}`;
    document.getElementById('totalExpenses').textContent = `$${stats.totalExpenses.toFixed(2)}`;
    document.getElementById('netIncome').textContent = `$${stats.netIncome.toFixed(2)}`;
    document.getElementById('pendingPayments').textContent = `$${stats.pendingPayments.toFixed(2)}`;
}

// Function to update health records
function updateHealthRecords() {
    const healthRecordsList = document.getElementById('healthRecordsList');
    healthRecordsList.innerHTML = '';

    // Sort health records by date (most recent first)
    const sortedRecords = [...healthRecords].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );

    sortedRecords.slice(0, 5).forEach(record => {
        const recordElement = document.createElement('div');
        recordElement.className = 'health-record-item';
        recordElement.innerHTML = `
            <div class="record-header">
                <span class="record-type">${record.type}</span>
                <span class="record-date">${new Date(record.date).toLocaleDateString()}</span>
            </div>
            <div class="record-details">
                <p>${record.description}</p>
                <p>Status: <span class="status-${record.status.toLowerCase()}">${record.status}</span></p>
            </div>
        `;
        healthRecordsList.appendChild(recordElement);
    });
}

// Function to update animal statistics
function updateAnimalStats() {
    const stats = {
        totalAnimals: animals.length,
        byType: {},
        byStatus: {},
        byAge: {
            young: 0,
            adult: 0,
            senior: 0
        }
    };

    animals.forEach(animal => {
        // Count by type
        stats.byType[animal.type] = (stats.byType[animal.type] || 0) + 1;

        // Count by status
        stats.byStatus[animal.status] = (stats.byStatus[animal.status] || 0) + 1;

        // Count by age
        const age = calculateAge(animal.birthDate);
        if (age < 1) stats.byAge.young++;
        else if (age < 5) stats.byAge.adult++;
        else stats.byAge.senior++;
    });

    // Update UI
    document.getElementById('totalAnimals').textContent = stats.totalAnimals;
    document.getElementById('byType').innerHTML = Object.entries(stats.byType)
        .map(([type, count]) => `<div>${type}: ${count}</div>`)
        .join('');
    document.getElementById('byStatus').innerHTML = Object.entries(stats.byStatus)
        .map(([status, count]) => `<div>${status}: ${count}</div>`)
        .join('');
    document.getElementById('byAge').innerHTML = `
        <div>Young (< 1 year): ${stats.byAge.young}</div>
        <div>Adult (1-5 years): ${stats.byAge.adult}</div>
        <div>Senior (> 5 years): ${stats.byAge.senior}</div>
    `;
}

// Function to calculate age in years
function calculateAge(birthDate) {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    
    return age;
}

// Update the main updateDashboard function
function updateDashboard() {
    updateFinancialStats();
    updateHealthRecords();
    updateAnimalStats();
    updateRecentActivity();
    updateUpcomingTasks();
    updateWeatherInfo();
} 