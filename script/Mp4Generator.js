/**
 * MP4生成専用クラス
 * base64形式の画像からMP4を生成する
 */

export class Mp4Generator {
    constructor() {
        this.muxer = null;
        this.videoEncoder = null;
        this.chunks = []; // MP4データチャンクを格納する配列
        this.isGenerating = false;
        this.isCancelled = false;
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
        this.isLibraryReady = false;
        this.initPromise = null;
        
        // mp4-muxerライブラリの読み込み確認（非同期）
        this.initPromise = this.initLibrary();
    }
    
    /**
     * mp4-muxerライブラリの初期化
     */
    async initLibrary() {
        try {
            await this.ensureMp4Library();
            this.isLibraryReady = true;
            console.log('Mp4Generator: mp4-muxerライブラリの準備完了');
        } catch (error) {
            console.error('Mp4Generator初期化失敗:', error);
            throw error;
        }
    }
    
    /**
     * Mp4Generatorが使用可能かチェック
     * @returns {boolean}
     */
    isReady() {
        return this.isLibraryReady;
    }
    
    /**
     * 初期化を待つ
     * @returns {Promise<void>}
     */
    async waitForReady() {
        if (this.initPromise) {
            await this.initPromise;
        }
        return this.isLibraryReady;
    }

    /**
     * mp4-muxerライブラリが利用可能かチェック
     */
    ensureMp4Library() {
        return new Promise((resolve, reject) => {
            if (typeof window.Mp4Muxer !== 'undefined') {
                resolve();
                return;
            }
            let attempts = 0;
            const maxAttempts = 50;
            const checkInterval = setInterval(() => {
                attempts++;
                if (typeof window.Mp4Muxer !== 'undefined') {
                    clearInterval(checkInterval);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    reject(new Error('mp4-muxerライブラリが読み込まれていません。'));
                }
            }, 100);
        });
    }

    /**
     * MP4生成を初期化
     * @param {Object} options - MP4生成オプション
     * @param {number} options.width - 幅
     * @param {number} options.height - 高さ
     * @param {number} options.framerate - フレームレート
     * @param {number} options.quality - 品質（1-100、高いほど高品質）
     * @param {string} options.codec - ビデオコーデック（デフォルト: 'avc'）
     */
    initialize(options = {}) {
        // mp4-muxerライブラリの確認
        if (!this.isLibraryReady) {
            throw new Error('mp4-muxerライブラリがまだ準備できていません。初期化をお待ちください。');
        }        if (typeof window.Mp4Muxer === 'undefined') {
            throw new Error('mp4-muxerライブラリが読み込まれていません。Mp4Generatorを使う前にmp4-muxerを読み込んでください。');
        }

        const defaultOptions = {
            width: 800,
            height: 600,
            framerate: 30,
            quality: 80,
            codec: 'avc'
        };
        const config = { ...defaultOptions, ...options };
        try {
            // MP4Muxerを初期化
            this.muxer = new window.Mp4Muxer.Muxer({
                target: new window.Mp4Muxer.ArrayBufferTarget(),
                fastStart: 'in-memory',
                video: {
                    codec: config.codec,
                    width: config.width,
                    height: config.height
                }
            });

            console.log('Mp4Generator初期化オプション:', config);
            return true;
        } catch (error) {
            console.error('Mp4Generatorの初期化に失敗:', error);
            throw error;
        }
    }

    /**
     * フレーム画像をMP4に追加
     * @param {string} base64Image - base64エンコードされた画像データ
     * @param {number} timestamp - フレームのタイムスタンプ（ミリ秒）
     * @returns {Promise<boolean>} 成功したかどうか
     */
    async addFrame(base64Image, timestamp = 0) {
        if (!this.muxer) {
            throw new Error('Mp4Generatorが初期化されていません');
        }

        if (!base64Image || !base64Image.startsWith('data:image/')) {
            console.warn('Mp4Generator: 無効なbase64画像データ');
            return false;
        }

        try {
            // Base64画像をImageオブジェクトに変換
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = base64Image;
            });
            // Canvasに描画してVideoFrameを作成
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // フレームをエンコーダーに追加
            if (!this.videoEncoder) {
                await this.initializeEncoder(img.width, img.height);
                // エンコーダー初期化後、設定された寸法を使用
                canvas.width = img.width;
                canvas.height = img.height;
            } else {
                // 既存のエンコーダーがある場合は、その設定に合わせる
                canvas.width = img.width;
                canvas.height = img.height;
            }
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // VideoFrameを作成
            const videoFrame = new VideoFrame(canvas, {
                timestamp: timestamp * 1000 // マイクロ秒に変換
            });

            this.videoEncoder.encode(videoFrame);
            videoFrame.close();

            console.log(`Mp4Generator: フレーム追加（タイムスタンプ${timestamp}ms）`);
            return true;
        } catch (error) {
            console.error('MP4へのフレーム追加に失敗:', error);
            return false;
        }
    }

    /**
     * ビデオエンコーダーを初期化
     * @param {number} width - ビデオの幅
     * @param {number} height - ビデオの高さ
     */
    async initializeEncoder(width, height) {
        this.videoEncoder = new VideoEncoder({
            output: (chunk, meta) => {
                this.muxer.addVideoChunk(chunk, meta);
            },
            error: (e) => {
                console.error('ビデオエンコードエラー:', e);
                if (this.onError) {
                    this.onError(e);
                }
            }
        });
        const config = {
            codec: this.getOptimalCodec(width, height), // 解像度に基づく最適なコーデック
            width: width,
            height: height,
            bitrate: 2_000_000, // 2Mbps
            framerate: 30
        };

        await this.videoEncoder.configure(config);
    }
    /**
     * 複数のフレーム画像から一括でMP4を生成
     * @param {Array<string>} base64Images - base64エンコードされた画像データの配列
     * @param {Object} options - 生成オプション
     * @param {number} options.delay - フレーム間隔（ミリ秒）
     * @returns {Promise<Blob>} 生成されたMP4のBlob
     */
    async generateFromImages(base64Images, options = {}) {
        if (!Array.isArray(base64Images) || base64Images.length === 0) {
            throw new Error('MP4生成用の画像がありません');
        }

        // 互換性チェック
        const compatibility = Mp4Generator.checkCompatibility();
        if (!compatibility.overall) {
            throw new Error('このブラウザではMP4生成がサポートされていません');
        }

        const delay = options.delay || 500; // デフォルト500ms間隔
        
        // キャンセル状態をリセット
        this.resetCancelState();
        this.isGenerating = true;

        try {
            console.log(`Mp4Generator: MP4生成開始（${base64Images.length}フレーム）`);

            // キャンセルチェック
            if (this.isCancelled) {
                throw new Error('MP4 generation was cancelled');
            }

            // 最初のフレームで初期化
            const firstImg = new Image();
            await new Promise((resolve, reject) => {
                firstImg.onload = resolve;
                firstImg.onerror = reject;
                firstImg.src = base64Images[0];
            });

            // MP4生成を初期化
            this.initialize({
                width: firstImg.width,
                height: firstImg.height,
                framerate: Math.round(1000 / delay)
            });

            // 各フレームを追加
            for (let i = 0; i < base64Images.length; i++) {
                // キャンセルチェック
                if (this.isCancelled) {
                    throw new Error('MP4 generation was cancelled');
                }
                
                const timestamp = i * delay;
                await this.addFrame(base64Images[i], timestamp);

                // 進捗報告
                if (this.onProgress) {
                    this.onProgress(Math.round((i + 1) / base64Images.length * 100));
                }
            }
            
            // キャンセルチェック
            if (this.isCancelled) {
                throw new Error('MP4 generation was cancelled');
            }
            
            // エンコーダーを終了
            if (this.videoEncoder && this.videoEncoder.state === 'configured') {
                await this.videoEncoder.flush();
                this.videoEncoder.close();
                this.videoEncoder = null;
            }
            // ミューサーを終了してMP4データを取得
            this.muxer.finalize();
            const { buffer } = this.muxer.target;

            console.log('Mp4Generator: MP4生成完了');
            // BlobとしてMP4データを返す
            const blob = new Blob([buffer], { type: 'video/mp4' });
            
            if (this.onComplete) {
                this.onComplete(blob);
            }

            return blob;
        } catch (error) {
            console.error('MP4生成失敗:', error);
            if (this.onError) {
                this.onError(error);
            }
            throw error;
        } finally {
            this.isGenerating = false;
            this.cleanup();
        }
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
        console.log('Mp4Generator: キャンセル要求を受信');
        this.isCancelled = true;
        if (this.isGenerating) {
            console.log('Mp4Generator: MP4生成をキャンセル');
            this.cleanup();
            this.isGenerating = false;
        }
    }

    /**
     * キャンセル状態をリセット
     */
    resetCancelState() {
        this.isCancelled = false;
    }
    
    /**
     * リソースをクリーンアップ
     */
    cleanup() {
        if (this.videoEncoder) {
            try {
                // エンコーダーの状態をチェックしてからクローズ
                if (this.videoEncoder.state === 'configured' || this.videoEncoder.state === 'unconfigured') {
                    this.videoEncoder.close();
                }
            } catch (e) {
                console.warn('ビデオエンコーダーのクローズ時エラー:', e);
            }
            this.videoEncoder = null;
        }

        if (this.muxer) {
            this.muxer = null;
        }
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
     * @param {string} filename - ファイル名（拡張子不要）
     */
    download(mp4Blob, filename = 'animation') {
        const url = this.createDownloadUrl(mp4Blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.mp4`;
        
        // リンクをクリックしてダウンロード
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // URLを解放
        this.revokeDownloadUrl(url);
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
            mp4Muxer: typeof window.Mp4Muxer !== 'undefined',
            canvas: typeof HTMLCanvasElement !== 'undefined',
            overall: false
        };
        
        compatibility.overall = compatibility.webCodecs && 
                               compatibility.mp4Muxer && 
                               compatibility.canvas;
        
        return compatibility;
    }

    /**
     * 解像度に基づいて適切なH.264コーデックレベルを選択
     * @param {number} width - ビデオの幅
     * @param {number} height - ビデオの高さ
     * @returns {string} 適切なコーデック文字列
     */
    getOptimalCodec(width, height) {
        const codedArea = width * height;
        
        // H.264 Levelの制限（ピクセル数）
        if (codedArea <= 99840) {    // 396x240 - Level 1.0
            return 'avc1.42E00A';
        } else if (codedArea <= 414720) {  // 720x576 - Level 3.0
            return 'avc1.42E01E';
        } else if (codedArea <= 921600) {  // 1280x720 - Level 3.1
            return 'avc1.42001F';
        } else if (codedArea <= 2073600) { // 1920x1080 - Level 4.0
            return 'avc1.420028';
        } else if (codedArea <= 8294400) { // 3840x2160 - Level 5.1
            return 'avc1.420033';
        } else {
            // 超高解像度の場合はLevel 6.0
            return 'avc1.420036';
        }
    }
}
