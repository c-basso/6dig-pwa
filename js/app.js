function copy(text) {
    return new Promise((resolve, reject) => {
        if (typeof navigator !== "undefined" && typeof navigator.clipboard !== "undefined" && navigator.permissions !== "undefined") {
            const type = "text/plain";
            const blob = new Blob([text], { type });
            const data = [new ClipboardItem({ [type]: blob })];
            navigator.permissions.query({ name: "clipboard-write" }).then((permission) => {
                if (permission.state === "granted" || permission.state === "prompt") {
                    navigator.clipboard.write(data).then(resolve, reject).catch(reject);
                }
                else {
                    reject(new Error("Permission not granted!"));
                }
            });
        }
        else if (document.queryCommandSupported && document.queryCommandSupported("copy")) {
            var textarea = document.createElement("textarea");
            textarea.textContent = text;
            textarea.style.position = "fixed";
            textarea.style.width = '2em';
            textarea.style.height = '2em';
            textarea.style.padding = 0;
            textarea.style.border = 'none';
            textarea.style.outline = 'none';
            textarea.style.boxShadow = 'none';
            textarea.style.background = 'transparent';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            try {
                document.execCommand("copy");
                document.body.removeChild(textarea);
                resolve();
            }
            catch (e) {
                document.body.removeChild(textarea);
                reject(e);
            }
        }
        else {
            reject(new Error("None of copying methods are supported by this browser!"));
        }
    });
}

const { createWorker } = Tesseract;

let worker = null;

const rectangle = {
    left: (640 / 2) - 150,
    top: (480 / 2) - 100,
    width: 300,
    height: 200
};

const initTesseract = async () => {
    worker = await createWorker('eng');

    await worker.setParameters({
        tessedit_write_images: true,
        tessedit_char_whitelist: '0123456789'
    });
}

let results = [];

const getCountOfDoubles = (arr) => {
    const res = {};

    arr.forEach((item) => {
        if (item in res) {
            res[item] += 1;
        } else {
            res[item] = 1;
        }
    });

    return res;
};

const format = (code) => {
    const by = 3;
    const numbers = code.split('');
    let result = '';

    numbers.forEach((num, index) => {
        if ((index + 1) % by === 0) {
            result += `${num} `;
        } else {
            result += `${num}`;
        }
    });

    return result.trim();
};

const getResultFromCounts = (counts) => {
    function compare(a, b) {
        const [, aVal] = a;
        const [, bVal] = b;

        if (aVal < bVal) {
            return -1;
        }
        if (aVal > bVal) {
            return 1;
        }

        return 0;
    }

    console.log(counts);

    const VALID_COUNT = 20;

    const entries = Object.entries(counts);

    if (entries.length === 1) {
        const [result] = entries;

        if (result[1] < 5) {
            return false;
        }

        return result;
    }

    const [result1, result2] = entries.sort(compare).reverse();

    if (result1 && result2 && result1[1] === VALID_COUNT && result2[1] === VALID_COUNT) {
        return false;
    }

    if (result1 && result2 && result1[1] - result2[1] < VALID_COUNT / 2) {
        return false;
    }

    if (result1 && result1[1] < VALID_COUNT) {
        return false;
    }

    return result1;
};

const recognize = async (image) => {
    const result = await worker.recognize(image, { rectangle });
    const text = result.data.text;

    const code = text.replace(/\D/g, '');

    if (code.length === 6) {
        results.push(code)
    }

    const counts = getCountOfDoubles(results);
    const bestMatch = getResultFromCounts(counts);

    if (bestMatch) {
        const [finish] = bestMatch;
        results = [];

        copy(finish)
            .then(console.log)
            .catch(console.error)
            .finally(() => {
                $('.result-content h1').text(format(finish));
                $('.result').modal('toggle');
            });

        return true;
    }
}

const shutDownWorker = async () => {
    await worker.terminate();
}

const drawMark = (ctx) => {
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 5;
    ctx.setLineDash([5, 10]);
    ctx.strokeRect(rectangle.left, rectangle.top, rectangle.width, rectangle.height);
};

const stopVideo = (stream) => {
    stream.getTracks().forEach((track) => {
        if (track.readyState == 'live') {
            track.stop();
        }
    });
}

const playStream = (canvas, stream) => {
    const video = document.createElement('video');

    video.addEventListener('loadedmetadata', function () {
        const context = canvas.getContext('2d');
        var drawFrame = async function () {
            context.drawImage(video, 0, 0);
            drawMark(context);

            const image = canvas.toDataURL('image/png');

            const ok = await recognize(image);

            if (!ok) {
                window.requestAnimationFrame(drawFrame);
            } else {
                stopVideo(stream);
            }
        };
        drawFrame();
    });
    video.autoplay = true;
    video.srcObject = stream;
}

const playCamera = (canvas, preferedWidth, preferedHeight) => {
    const devices = navigator.mediaDevices;

    if (devices && 'getUserMedia' in devices) {
        const promise = devices.getUserMedia({
            video: {
                width: preferedWidth,
                height: preferedHeight
            }
        });

        promise
            .then((stream) => {
                playStream(canvas, stream);
            })
            .catch((error) => {
                console.error(error.name + ': ' + error.message);
            });
    } else {
        console.error('Camera API is not supported.');
    }
}

$(document).ready(function() {
    $('.restart').click(function () {
        $('.result').modal('toggle');

        const canvas = document.querySelector('#canvas');
        playCamera(canvas, canvas.width, canvas.height);
    });
});

initTesseract()
        .then(() => {
            const canvas = document.querySelector('#canvas');
            playCamera(canvas, canvas.width, canvas.height);
        });