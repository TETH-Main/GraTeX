/**
 * MP4生成専用クラス
 * base64形式の画像からMP4を生成する
 */

export class Mp4Generator {
    constructor(ffmpegInstance = null) {
        this.ffmpeg = ffmpegInstance;
        this.ready = false;
        this.progressCallback = null;
        this.initPromise = this.init();
        this.isGenerating = false;
    }

    async init() {
        if (this.ffmpeg) {
            this.ready = true;
            return;
        }
        if (typeof SharedArrayBuffer === 'undefined') {
            throw new Error('SharedArrayBuffer is not defined. MP4生成不可。');
        }
        if (window.FFmpeg) {
            this.ffmpeg = window.FFmpeg.createFFmpeg({ log: true, progress: p => this.progressCallback?.(p.ratio || 0) });
        } else if (window.createFFmpeg) {
            this.ffmpeg = window.createFFmpeg({ log: true, progress: p => this.progressCallback?.(p.ratio || 0) });
        } else {
            throw new Error('FFmpeg.wasmがwindow.FFmpegまたはwindow.createFFmpegとしてロードされていません。\n<script src="./libs/ffmpeg.min.js"></script> をHTMLに追加してください。');
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

    /**
     * 進捗コールバックを設定
     * @param {Function} callback - 進捗コールバック (0-100の数値を受け取る)
     */
    setProgressCallback(callback) {
        this.onProgress = callback;
    }

    /**
     * 完了コールバックを設定
     * @param {Function} callback - 完了コールバック (Blobを受け取る)
     */
    setCompleteCallback(callback) {
        this.onComplete = callback;
    }

    /**
     * エラーコールバックを設定
     * @param {Function} callback - エラーコールバック (Errorを受け取る)
     */
    setErrorCallback(callback) {
        this.onError = callback;
    }

    /**
     * base64画像配列→MP4 Blob
     * @param {Array<string>} base64Array - base64エンコードされた画像データの配列
     * @param {Object} options - 生成オプション
     * @param {number} options.delay - フレーム間隔（ミリ秒）
     * @returns {Promise<Blob>} 生成されたMP4のBlob
     */
    async generateFromImages(base64Array, options = {}) {
        await this.waitForReady();
        const ffmpeg = this.ffmpeg;
        this.isGenerating = true;
        // 画像を仮想FSに書き込む
        for (let i = 0; i < base64Array.length; ++i) {
            const b64 = base64Array[i].replace(/^data:image\/(png|jpeg);base64,/, '');
            const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            const filename = `frame_${String(i).padStart(4, '0')}.png`;
            ffmpeg.FS('writeFile', filename, buf);
        }
        // FFmpegコマンドでMP4生成
        const framerate = options.framerate || (options.delay ? Math.round(1000 / options.delay) : 30);
        const outName = 'out.mp4';
        await ffmpeg.run(
            '-framerate', String(framerate),
            '-i', 'frame_%04d.png',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-y', outName
        );
        const data = ffmpeg.FS('readFile', outName);
        // 仮想FSをクリーンアップ
        for (let i = 0; i < base64Array.length; ++i) {
            const filename = `frame_${String(i).padStart(4, '0')}.png`;
            try { ffmpeg.FS('unlink', filename); } catch {}
        }
        try { ffmpeg.FS('unlink', outName); } catch {}
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        this.isGenerating = false;
        this.onComplete?.(blob);
        return blob;
    }

    /**
     * MP4データをダウンロード用URLとして取得
     * @param {Blob} mp4Blob - MP4のBlob
     * @returns {string} ダウンロード用URL
     */
    createDownloadUrl(mp4Blob) {
        return URL.createObjectURL(mp4Blob);
    }

    /**
     * ダウンロード用URLを解放
     * @param {string} url - 解放するURL
     */
    revokeDownloadUrl(url) {
        URL.revokeObjectURL(url);
    }

    /**
     * MP4ファイルをダウンロード
     * @param {Blob} mp4Blob - MP4のBlob
     * @param {string} filename - ファイル名
     */
    download(mp4Blob, filename = 'animation.mp4') {
        const url = this.createDownloadUrl(mp4Blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.revokeDownloadUrl(url);
    }

    /**
     * 生成中かどうかをチェック
     * @returns {boolean}
     */
    isGeneratingMp4() {
        return this.isGenerating;
    }

    /**
     * MP4生成をキャンセル
     */
    cancel() {
        if (this.isGenerating) {
            this.cleanup();
            this.isGenerating = false;
        }
    }

    /**
     * リソースをクリーンアップ
     */
    cleanup() {
        // FFmpeg.wasm版では特にリソース解放不要だが、将来の拡張用
    }

    /**
     * 解像度に基づいて適切なH.264コーデックレベルを選択
     * @param {number} width - ビデオの幅
     * @param {number} height - ビデオの高さ
     * @returns {string} 適切なコーデック文字列
     */
    getOptimalCodec(width, height) {
        const codedArea = width * height;
        if (codedArea <= 99840) {
            return 'avc1.42E00A';
        } else if (codedArea <= 414720) {
            return 'avc1.42E01E';
        } else if (codedArea <= 921600) {
            return 'avc1.42001F';
        } else if (codedArea <= 2073600) {
            return 'avc1.420028';
        } else if (codedArea <= 8294400) {
            return 'avc1.420033';
        } else {
            return 'avc1.420036';
        }
    }

    /**
     * WebCodecs APIが利用可能かチェック
     * @returns {boolean} WebCodecs APIが利用可能な場合true
     */
    static isWebCodecsSupported() {
        return typeof VideoEncoder !== 'undefined' &&
               typeof VideoFrame !== 'undefined' &&
               typeof VideoEncoder.isConfigSupported !== 'undefined';
    }

    /**
     * ブラウザーの互換性をチェック
     * @returns {Object} 互換性情報
     */
    static checkCompatibility() {
        const compatibility = {
            webCodecs: this.isWebCodecsSupported(),
            mp4Muxer: typeof Mp4Muxer !== 'undefined',
            canvas: typeof HTMLCanvasElement !== 'undefined',
            overall: false
        };
        compatibility.overall = compatibility.webCodecs && compatibility.mp4Muxer && compatibility.canvas;
        return compatibility;
    }
}
