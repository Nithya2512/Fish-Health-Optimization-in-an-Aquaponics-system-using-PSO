document.addEventListener('DOMContentLoaded', () => {
    const fishCards = document.querySelectorAll('.fish-card');
    const optimizeBtn = document.getElementById('optimizeBtn');
    const results = document.getElementById('results');

    let selectedSpecies = 'tilapia';
    let groupedChart = null;
    let convergenceChart = null;
    const circumference = 2 * Math.PI * 92;

    // Fish Selection
    function updateFishSelection() {
        fishCards.forEach(card => {
            const isSelected = card.dataset.species === selectedSpecies;

            card.classList.toggle('selected', isSelected);

            const statusEl = card.querySelector('div:last-child span');
            statusEl.textContent = isSelected ? 'SELECTED' : 'Click to Select';
            statusEl.className = isSelected
                ? 'text-sm font-medium text-primary'
                : 'text-sm font-medium text-gray-400';
        });
    }

    fishCards.forEach(card => card.addEventListener('click', () => {
        selectedSpecies = card.dataset.species;
        updateFishSelection();
    }));

    updateFishSelection();

    // Sliders
    const scrolls = [
        { input: 'temp', display: 'tempVal', decimals: 1 },
        { input: 'pH', display: 'pHVal', decimals: 1 },
        { input: 'do', display: 'doVal', decimals: 1 },
        { input: 'ammonia', display: 'ammoniaVal', decimals: 3 },
        { input: 'nitrate', display: 'nitrateVal', decimals: 0 },
        { input: 'biomass', display: 'biomassVal', decimals: 1 }
    ];

    scrolls.forEach(({ input, display, decimals }) => {
        const inputEl = document.getElementById(input);
        const displayEl = document.getElementById(display);

        const update = () => {
            const value = parseFloat(inputEl.value).toFixed(decimals);

            displayEl.textContent = value;

            const bad =
                (input === 'ammonia' && value > 0.02) ||
                (input === 'do' && value < 4.5);

            displayEl.parentElement.style.color = bad ? '#ff6b6b' : '#00c2cb';
        };

        inputEl.addEventListener('input', update);
        update();
    });

    // Ripple
    optimizeBtn.addEventListener('click', function (e) {
        const rect = this.getBoundingClientRect();

        const size = Math.max(rect.width, rect.height) * 2;

        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        const ripple = document.createElement('div');
        ripple.classList.add('ripple');

        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';

        this.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);

        runOptimization();
    });
        // FHI Circle
    function updateFHICircle(type, value) {
        const circle = document.querySelector(`.fhi-circle[data-type="${type}"]`);
        const ring = circle.querySelector('.fhi-ring');
        const percent = circle.querySelector('.fhi-percent');
        const status = circle.querySelector('.fhi-status');

        const gradientId = type === 'current'
            ? 'current-gradient'
            : 'predicted-gradient';

        const dash = (value / 100) * circumference;

        ring.style.strokeDasharray = `${dash} ${circumference - dash}`;

        let current = 0;
        const duration = 1500;
        const start = performance.now();

        function animate(time) {
            const elapsed = time - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 0.5 * (1 - Math.cos(progress * Math.PI));

            const display = Math.floor(eased * value);

            percent.textContent = `${display}%`;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }

        requestAnimationFrame(animate);

        let color1, color2, label;

        if (value <= 40) {
            color1 = '#ef4444';
            color2 = '#dc2626';
            label = 'Critical';
        }
        else if (value <= 70) {
            color1 = '#f59e0b';
            color2 = '#d97706';
            label = 'Warning';
        }
        else {
            color1 = '#10b981';
            color2 = '#059669';
            label = 'Healthy';
        }

        const gradient = document.getElementById(gradientId);

        gradient.innerHTML =
            `<stop offset="0%" stop-color="${color1}"/><stop offset="100%" stop-color="${color2}"/>`;

        status.textContent = label;
        status.style.color = color1;
    }


    // Bar Chart
    function createGroupedBarChart(current, predicted) {

        const ctx = document
            .getElementById('groupedBarChart')
            .getContext('2d');

        if (groupedChart) groupedChart.destroy();

        const labels = [
            'Temp (°C)',
            'pH',
            'DO (mg/L)',
            'NH₃ (mg/L)',
            'NO₃ (mg/L)'
        ];

        const currentData = [
            current.temp,
            current.pH,
            current.do,
            current.ammonia,
            current.nitrate
        ];

        const predictedData = [
            predicted.temp,
            predicted.pH,
            predicted.DO,
            predicted.ammonia,
            predicted.nitrate
        ];

        groupedChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Current',
                        data: currentData,
                        backgroundColor: '#00c2cb',
                        borderRadius: 6,
                        barThickness: 20
                    },
                    {
                        label: 'Predicted',
                        data: predictedData,
                        backgroundColor: '#10b981',
                        borderRadius: 6,
                        barThickness: 20
                    }

                                    ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#fff'
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#fff'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#334155'
                        },
                        ticks: {
                            color: '#fff'
                        }
                    }
                }
            }
        });
    }

    // Convergence Graph
    function createConvergenceChart(data, totalIters, fhiBefore, fhiAfter) {
        const ctx = document.getElementById('convergenceChart').getContext('2d');

        if (convergenceChart) convergenceChart.destroy();

        // Prepend fhiBefore (iteration 0) and append fhiAfter (iteration totalIters + 1)
        const displayData = [fhiBefore, ...data, fhiAfter].map(v => parseFloat(v.toFixed(2)));

        // Create iteration-based labels (0 to totalIters + 1)
        const labels = Array.from({ length: displayData.length }, (_, i) => i);

        // Calculate dynamic y-axis range with buffer for one extra point
        const fhiValues = displayData;
        const minFHI = Math.floor((Math.min(...fhiValues) - 0.05) * 100) / 100; // Subtract buffer, round down to 0.01
        const maxFHI = Math.ceil((Math.max(...fhiValues) + 0.05) * 100) / 100; // Add buffer, round up to 0.01

        const stepSize = parseFloat(((maxFHI - minFHI) / 10).toFixed(2)); // Uniform step size for ~10 ticks

        // Edge case: if data is empty or invalid, log warning and return
        if (!displayData || displayData.length < 2) {
            console.warn('Insufficient convergence data to render chart');
            return;
        }

        convergenceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Fish Health Index',
                    data: displayData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    fill: true,
                    tension: 0, // Straight lines
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#fff',
                            font: {
                                size: 14
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.9)',
                        titleColor: '#10b981',
                        bodyColor: '#fff',
                        callbacks: {
                            label: ctx => ctx.raw.toFixed(2) // Display tooltip in 0.00 format
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: `PSO Iteration (Total: ${totalIters + 1})`,
                            color: '#10b981',
                            font: {
                                size: 13
                            }
                        },
                                            grid: {
                            color: '#334155'
                        },
                        ticks: {
                            color: '#fff'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Fish Health Index',
                            color: '#fff'
                        },
                        min: minFHI,
                        max: maxFHI,
                        grid: {
                            color: '#334155'
                        },
                        ticks: {
                            color: '#fff',
                            stepSize: stepSize,
                            callback: v => v.toFixed(2) // Display ticks in 0.00 format
                        }
                    }
                },
                animation: {
                    duration: 1400,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    // Run Optimization
    async function runOptimization() {

        const data = {
            species: selectedSpecies,

            current_params: {
                temp: parseFloat(document.getElementById('temp').value),
                pH: parseFloat(document.getElementById('pH').value),
                do: parseFloat(document.getElementById('do').value),
                ammonia: parseFloat(document.getElementById('ammonia').value),
                nitrate: parseFloat(document.getElementById('nitrate').value)
            },

            biomass_kg: parseFloat(document.getElementById('biomass').value)
        };

        results.classList.remove('hidden');

        updateFHICircle('current', 0);
        updateFHICircle('predicted', 0);

        try {

            const res = await fetch('/optimize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const r = await res.json();

            if (!res.ok)
                throw new Error(r.error);

            setTimeout(() => {

                const currentFHI = Math.round(r.fhi_before * 100);
                const predictedFHI = Math.round(r.fhi_after * 100);

                updateFHICircle('current', currentFHI);
                updateFHICircle('predicted', predictedFHI);

                createGroupedBarChart(data.current_params, r.predicted_state);

                const inputs = data.current_params;

                document.getElementById('currentInputs').innerHTML = `
                    <div class="flex justify-between p-3 bg-white/10 rounded-lg"><span>Temp</span><strong class="text-cyan-300">${inputs.temp}°C</strong></div>
                    <div class="flex justify-between p-3 bg-white/10 rounded-lg"><span>pH</span><strong class="text-cyan-300">${inputs.pH}</strong></div>
                    <div class="flex justify-between p-3 bg-white/10 rounded-lg"><span>DO</span><strong class="text-cyan-300">${inputs.do} mg/L</strong></div>
                    <div class="flex justify-between p-3 bg-white/10 rounded-lg"><span>NH₃</span><strong class="text-amber-400">${inputs.ammonia} mg/L</strong></div>
                    <div class="flex justify-between p-3 bg-white/10 rounded-lg"><span>NO₃</span><strong class="text-emerald-400">${inputs.nitrate} mg/L</strong></div>
                    <div class="flex justify-between p-3 bg-white/10 rounded-lg"><span>Biomass</span><strong class="text-cyan-300">${data.biomass_kg} kg</strong></div>
                `;
                                const rec = r.recommended;

                const actions = [
                    `Feed <strong>${rec.FR}%</strong> of body weight`,
                    `Aeration: <strong>${(rec.A * 100).toFixed(0)}%</strong>`,
                    `Water exchange: <strong>${(rec.WER * 100).toFixed(1)}%</strong>`,
                    `Target temp: <strong>${rec.Temp_sp}°C</strong>`
                ];

                const ul = document.getElementById('actions');
                ul.innerHTML = '';

                actions.forEach(a => {
                    const li = document.createElement('li');

                    li.className =
                        'flex items-start gap-3 p-4 bg-white/10 rounded-lg backdrop-blur-sm';

                    li.innerHTML =
                        `<i data-lucide="arrow-right-circle" class="w-5 h-5 text-emerald-400 mt-0.5"></i><span class="font-medium text-white">${a}</span>`;

                    ul.appendChild(li);
                });

                // Populate Implementation Guide
                const implementation = [
                    `Adjust feeding to ${rec.FR}% of body weight by measuring daily feed based on the total biomass (${data.biomass_kg} kg) and distributing it evenly across feeding times.`,
                    `Set aeration to ${(rec.A * 100).toFixed(0)}% by adjusting your aerator’s flow rate or runtime to maintain optimal dissolved oxygen levels.`,
                    `Perform a ${(rec.WER * 100).toFixed(1)}% water exchange by replacing the specified volume of tank water with fresh, dechlorinated water over the next 24 hours.`,
                    `Regulate water temperature to ${rec.Temp_sp}°C using a heater or chiller, ensuring gradual changes to avoid stressing the fish.`
                ];

                const implDiv = document.getElementById('implementation');

                implDiv.innerHTML = '';

                implementation.forEach(step => {
                    const div = document.createElement('div');

                    div.className =
                        'flex items-start gap-3 p-4 bg-white/10 rounded-lg backdrop-blur-sm';

                    div.innerHTML =
                        `<i data-lucide="info" class="w-5 h-5 text-cyan-400 mt-0.5"></i><span class="font-medium text-white">${step}</span>`;

                    implDiv.appendChild(div);
                });

                const pred = r.predicted_state;

                document.getElementById('predicted').innerHTML = `
                    <div class="flex justify-between p-3 bg-white/10 rounded-lg"><span>DO</span><strong class="text-emerald-400">${pred.DO} mg/L</strong></div>
                    <div class="flex justify-between p-3 bg-white/10 rounded-lg"><span>Temp</span><strong class="text-emerald-400">${pred.temp}°C</strong></div>
                    <div class="flex justify-between p-3 bg-white/10 rounded-lg"><span>pH</span><strong class="text-emerald-400">${pred.pH}</strong></div>
                    <div class="flex justify-between p-3 bg-white/10 rounded-lg"><span>NH₃</span><strong class="text-amber-400">${pred.ammonia} mg/L</strong></div>
                    <div class="flex justify-between p-3 bg-white/10 rounded-lg"><span>NO₃</span><strong class="text-emerald-400">${pred.nitrate} mg/L</strong></div>
                `;

                // Convergence Graph
                if (r.convergence && r.convergence.length > 0) {
                    document.getElementById('convergenceCard').classList.remove('hidden');

                    createConvergenceChart(
                        r.convergence,
                        r.iterations_used,
                        r.fhi_before,
                        r.fhi_after
                    );
                }

                lucide.createIcons();

            }, 800);

        } catch (err) {
            alert('Error: ' + err.message);
        }
    }
});