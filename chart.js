(() => {
    const canvas = document.getElementById('chart');
    if (!canvas || !window.Chart) return;

    const ctx = document.getElementById('chart').getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    // top color
    gradient.addColorStop(0, 'rgba(75,192,192,0.4)');
    // bottom color (fade out)
    gradient.addColorStop(1, 'rgba(75,192,192,0)');

    var data = {
        datasets: [
            {
                label: 'Dataset 1 (Linear Interpolation)',
                //borderDash: [8, 4],
                data: [],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,0.15)',
                tension: 0.4,
                backgroundColor: gradient,
                fill: true,
            },
            {
                label: 'Dataset 2 (Cubic Interpolation)',
                cubicInterpolationMode: 'monotone',
                data: [],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,0.15)',
            }
        ]
    };

    const onReceive = function(event) {
        this.data.datasets[event.index].data.push({
            x: event.timestamp,
            y: event.value
        });
        this.update('quiet');
    };

    const timeoutIDs = [];

    const startFeed = (chart, index) => {
        var receive = () => {
            onReceive.call(chart, {
                index: index,
                timestamp: Date.now(),
            });
        };
    };

    const stopFeed = index => {
        if (index === undefined) {
            for (const id of timeoutIDs) {
                clearTimeout(id);
            }
        } else {
            clearTimeout(timeoutIDs[index]);
        }
    };

    const start = chart => {
        startFeed(chart, 0);
        startFeed(chart, 1);
    };

    const stop = () => {
        stopFeed();
    };

    const config = {
        type: 'line',
        data: data,
        plugins: [
            {
                start: start,
                stop: stop
            }
        ],
        options: {
            maintainAspectRatio: false,
            plugins: {
                streaming: {
                    frameRate: 60   // chart is drawn 5 times every second
                }
            },
            scales: {
                x: {
                    type: 'realtime',
                    realtime: {
                        duration: 20000,
                        delay: 2000
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'ValueStr'
                    }
                }
            },
            interaction: {
                intersect: false
            }
        }
    };

    // Build chart
    var chart = new Chart(canvas, config);

    // SSE connection
    let es;
    function connect() {
        es = new EventSource('/events'); // server should emit { "date": "...", "value": ... }

        es.addEventListener('message', (e) => {
            try {
                const payload = JSON.parse(e.data);
                if (!payload) return;
                if (payload.type === 'connected') return;

                const x = payload.date ? new Date(payload.date) : new Date();
                const y = Number(payload.value);
                if (!Number.isFinite(y)) return;
                console.log(x,y)
                data.datasets[0].data.push({
                    x: x,
                    y: y
                });

                // update chart datasets keeping the current animation
                chart.update();
                // Enqueue for animated segment draw

            } catch (err) {
                console.error('SSE parse error', err);
            }
        });
    }

    connect();


    function cleanup() {
        try { if (es) es.close(); } catch {}
        try { chart?.destroy(); } catch {}
        try { stop(); } catch {}
        es = null;
    }
    document.body.addEventListener('htmx:beforeSwap', (evt) => {
        const target = evt.detail?.target;
        if (target && (target.id === 'content' || target.closest?.('#content'))) {
            cleanup();
        }
    });

    window.addEventListener('beforeunload', cleanup);
})()