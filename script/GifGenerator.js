/**
 * GIF生成専用クラス
 * base64形式の画像からGIFを生成する
 */

export class GifGenerator {
    constructor(ffmpegInstance = null) {
        this.ffmpeg = ffmpegInstance; // MovieGenerator.jsから渡す
        this.ready = false;
        this.progressCallback = null;
        this.initPromise = this.init();
    }

    async init() {
        if (this.ffmpeg) {
            this.ready = true;
            return;
        }
        // MovieGenerator.jsからffmpegをセットしない場合はwindow.FFmpeg等を使う
        if (typeof SharedArrayBuffer === 'undefined') {
            alert('GIF生成にはSharedArrayBuffer対応が必要です。');
            throw new Error('SharedArrayBuffer is not defined. GIF生成不可。');
        }
        if (window.FFmpeg) {
            this.ffmpeg = window.FFmpeg.createFFmpeg({ log: true, progress: p => this.progressCallback?.(p.ratio || 0) });
        } else if (window.createFFmpeg) {
            this.ffmpeg = window.createFFmpeg({ log: true, progress: p => this.progressCallback?.(p.ratio || 0) });
        } else {
            throw new Error('FFmpeg.wasmがwindow.FFmpegまたはwindow.createFFmpegとしてロードされていません。');
        }
        await this.ffmpeg.load();
        this.ready = true;
    }

    async waitForReady() {
        await this.initPromise;
    }

    isReady() {
        return this.ready;
    }

    setProgressCallback(cb) {
        this.progressCallback = cb;
    }

    /**
     * base64画像配列→GIF Blob
     * @param {Array<string>} base64Array - base64エンコードされた画像データの配列
     * @param {Object} options - 生成オプション
     * @param {number} options.delay - フレーム間隔（ミリ秒）
     * @returns {Promise<Blob>} 生成されたGIFのBlob
     */
    async generateFromImages(base64Array, options = {}) {
        await this.waitForReady();
        const ffmpeg = this.ffmpeg;
        // 画像を仮想FSに書き込む
        for (let i = 0; i < base64Array.length; ++i) {
            const b64 = base64Array[i].replace(/^data:image\/(png|jpeg);base64,/, '');
            const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            const filename = `frame_${String(i).padStart(4, '0')}.png`;
            ffmpeg.FS('writeFile', filename, buf);
        }
        // FFmpegコマンドでGIF生成
        const framerate = options.framerate || (options.delay ? Math.round(1000 / options.delay) : 10);
        const outName = 'out.gif';
        await ffmpeg.run(
            '-framerate', String(framerate),
            '-i', 'frame_%04d.png',
            '-vf', 'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
            '-y', outName
        );
        const data = ffmpeg.FS('readFile', outName);
        // 仮想FSをクリーンアップ
        for (let i = 0; i < base64Array.length; ++i) {
            const filename = `frame_${String(i).padStart(4, '0')}.png`;
            try { ffmpeg.FS('unlink', filename); } catch {}
        }
        try { ffmpeg.FS('unlink', outName); } catch {}
        return new Blob([data.buffer], { type: 'image/gif' });
    }

    /**
     * generateFromBase64Array: generateFromImagesのエイリアス（後方互換）
     */
    async generateFromBase64Array(base64Images, options = {}) {
        return this.generateFromImages(base64Images, options);
    }

    /**
     * base64画像をImageオブジェクトに変換
     * @param {string} base64Data - base64形式の画像データ
     * @returns {Promise<HTMLImageElement>}
     */
    base64ToImage(base64Data) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = base64Data;
        });
    }

    /**
     * 画像をCanvasに描画してピクセルデータを取得
     * @param {HTMLImageElement} image - 画像要素
     * @param {number} width - キャンバス幅
     * @param {number} height - キャンバス高さ
     * @returns {ImageData}
     */
    imageToImageData(image, width, height) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(image, 0, 0, width, height);
        return ctx.getImageData(0, 0, width, height);
    }

    /**
     * GIF品質を調整（フレーム数に応じて自動調整）
     * @param {number} frameCount - フレーム数
     * @returns {number} 推奨品質値
     */
    getOptimalQuality(frameCount) {
        if (frameCount <= 10) return 5;
        if (frameCount <= 30) return 10;
        if (frameCount <= 60) return 15;
        return 20;
    }

    /**
     * 現在の生成状態を取得
     * @returns {boolean}
     */
    getGeneratingStatus() {
        return this.isGenerating;
    }

    /**
     * リソースをクリーンアップ
     */
    dispose() {
        if (this.gif) {
            this.gif.abort();
            this.gif = null;
        }
        this.isGenerating = false;
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
    }

    /**
     * Blobをダウンロード用URLに変換
     * @param {Blob} blob - GIFブロブ
     * @returns {string} ダウンロード用URL
     */
    createDownloadUrl(blob) {
        return URL.createObjectURL(blob);
    }

    /**
     * GIFをダウンロード
     * @param {Blob} blob - GIFブロブ
     * @param {string} filename - ファイル名
     */
    downloadGif(blob, filename = 'animation.gif') {
        const url = this.createDownloadUrl(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 進捗コールバックを設定
     * @param {Function} callback - 進捗コールバック (0-1の値)
     */
    setProgressCallback(callback) {
        this.onProgress = callback;
    }

    /**
     * 完了コールバックを設定
     * @param {Function} callback - 完了コールバック
     */
    setCompleteCallback(callback) {
        this.onComplete = callback;
    }

    /**
     * エラーコールバックを設定
     * @param {Function} callback - エラーコールバック
     */
    setErrorCallback(callback) {
        this.onError = callback;
    }

    /**
     * フレームレートからdelayを計算
     * @param {number} fps - フレームレート
     * @returns {number} ミリ秒単位のdelay
     */
    static fpsToDelay(fps) {
        return Math.round(1000 / Math.max(1, Math.min(60, fps)));
    }
}
