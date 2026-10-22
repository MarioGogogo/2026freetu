"use client";
import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react"
import { ToastContainer } from "react-toastify";
import { toast } from "react-toastify";
import Link from "next/link";
import LoadingOverlay from "@/components/LoadingOverlay";
import ThemeToggle from "@/components/ThemeToggle";
import { compressImage } from '@/lib/compress';

// 上传通道显示名映射
const CHANNEL_LABELS = {
  r2: 'Cloudflare R2',
  tgchannel: 'TG_Channel',
  tg: 'TG(会失效)',
  '58img': '58img',
};

// 文件类型徽章渐变色
const EXT_GRADIENTS = {
  PNG: 'from-sky-400 to-indigo-500',
  JPG: 'from-amber-400 to-rose-500',
  JPEG: 'from-amber-400 to-rose-500',
  GIF: 'from-emerald-400 to-teal-500',
  WEBP: 'from-violet-400 to-fuchsia-500',
};

const fmtMB = (bytes) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getExt = (file) => (file.name.split('.').pop() || '').toUpperCase().slice(0, 4);

const LoginButton = ({ onClick, href, children }) => {
  const cls = "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-apple-blue hover:bg-apple-blueHover text-white text-xs font-semibold tracking-wide shadow-sm shadow-blue-500/30 transition transform active:scale-95";
  if (href) {
    return <Link href={href} className={cls}>{children}</Link>;
  }
  return (
    <button onClick={onClick} className={cls} type="button">
      {children}
    </button>
  );
};

export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploadedFilesNum, setUploadedFilesNum] = useState(0);
  const [selectedImage, setSelectedImage] = useState(null); // 选中的放大图片
  const [activeTab, setActiveTab] = useState('preview');
  const [uploading, setUploading] = useState(false);
  const [IP, setIP] = useState('');
  const [Total, setTotal] = useState('?');
  const [selectedOption, setSelectedOption] = useState('r2'); // 上传通道
  const [uploadMode, setUploadMode] = useState('original'); // original=原图上传 compress=压缩上传
  const [quality, setQuality] = useState(80); // 压缩质量百分比
  const [isAuthapi, setisAuthapi] = useState(false);
  const [Loginuser, setLoginuser] = useState('');
  const [fileMeta, setFileMeta] = useState({}); // 文件名 -> { dims, compressedSize }

  const parentRef = useRef(null);
  const albumInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
  }

  useEffect(() => {
    ip();
    getTotal();
    isAuth();
  }, []);

  // 压缩模式下懒计算真实压缩后体积（防抖），用于对比条
  useEffect(() => {
    if (uploadMode !== 'compress' || selectedFiles.length === 0) return;
    const timer = setTimeout(async () => {
      for (const f of selectedFiles) {
        const compressed = await compressImage(f, { quality: quality / 100 });
        setFileMeta(prev => ({
          ...prev,
          [f.name]: { ...(prev[f.name] || {}), compressedSize: compressed.size },
        }));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [uploadMode, quality, selectedFiles]);

  // 读取图片原始尺寸
  const loadDims = (file) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      setFileMeta(prev => ({
        ...prev,
        [file.name]: { ...(prev[file.name] || {}), dims: `${img.naturalWidth} × ${img.naturalHeight}` },
      }));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  const ip = async () => {
    try {
      const res = await fetch(`/api/ip`, {
        method: "GET",
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setIP(data.ip);
    } catch (error) {
      console.error('请求出错:', error);
    }
  };

  const isAuth = async () => {
    try {
      const res = await fetch(`/api/enableauthapi/isauth`, {
        method: "GET",
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        setisAuthapi(true)
        setLoginuser(data.role)
      } else {
        setisAuthapi(false)
        setSelectedOption("58img")
      }
    } catch (error) {
      console.error('请求出错:', error);
    }
  };

  const getTotal = async () => {
    try {
      const res = await fetch(`/api/total`, {
        method: "GET",
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setTotal(data.total);
    } catch (error) {
      console.error('请求出错:', error);
    }
  }

  const addFiles = (incoming) => {
    const filtered = Array.from(incoming).filter(file =>
      !selectedFiles.find(selFile => selFile.name === file.name) &&
      !uploadedImages.find(upImg => upImg.name === file.name));
    filtered.forEach(loadDims);
    setSelectedFiles([...selectedFiles, ...filtered]);
  };

  const handleFileChange = (event) => {
    addFiles(event.target.files);
    event.target.value = ''; // 允许重复选择同一文件
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setFileMeta({});
  };

  const getTotalSizeInMB = (files) => {
    const totalSizeInBytes = Array.from(files).reduce((acc, file) => acc + file.size, 0);
    return (totalSizeInBytes / (1024 * 1024)).toFixed(2);
  };

  const getMeta = (file) => fileMeta[file.name] || {};

  // 真实节省百分比
  const savingPct = (file) => {
    const m = getMeta(file);
    if (!m.compressedSize || m.compressedSize >= file.size) return 0;
    return Math.round((1 - m.compressedSize / file.size) * 1000) / 10;
  };

  // 底部 Dock 汇总体积（压缩模式取压缩后体积）
  const optimizedBytes = selectedFiles.reduce(
    (acc, f) => acc + (uploadMode === 'compress' ? (getMeta(f).compressedSize ?? f.size) : f.size), 0);

  const handleUpload = async (file = null) => {
    setUploading(true);

    const filesToUpload = file ? [file] : selectedFiles;

    if (filesToUpload.length === 0) {
      toast.error('请选择要上传的文件');
      setUploading(false);
      return;
    }

    const formFieldName = selectedOption === "tencent" ? "media" : "file";
    let successCount = 0;

    try {
      for (const file of filesToUpload) {
        let fileToUpload = file;
        if (uploadMode === 'compress') {
          fileToUpload = await compressImage(file, { quality: quality / 100 });
        }

        const formData = new FormData();

        formData.append(formFieldName, fileToUpload);

        try {
          const targetUrl = selectedOption === "tgchannel" || selectedOption === "r2"
            ? `/api/enableauthapi/${selectedOption}`
            : `/api/${selectedOption}`;

          const response = await fetch(targetUrl, {
            method: 'POST',
            body: formData,
            headers: headers
          });

          if (response.ok) {
            const result = await response.json();

            fileToUpload.url = result.url;

            // 更新 uploadedImages 和 selectedFiles
            setUploadedImages((prevImages) => [...prevImages, fileToUpload]);
            setSelectedFiles((prevFiles) => prevFiles.filter(f => f !== file));
            successCount++;
          } else {
            // 尝试从响应中提取错误信息
            let errorMsg;
            try {
              const errorData = await response.json();
              errorMsg = errorData.message || `上传 ${file.name} 图片时出错`;
            } catch (jsonError) {
              errorMsg = `上传 ${file.name} 图片时发生未知错误`;
            }

            switch (response.status) {
              case 400:
                toast.error(`请求无效: ${errorMsg}`);
                break;
              case 403:
                toast.error(`无权限访问资源: ${errorMsg}`);
                break;
              case 404:
                toast.error(`资源未找到: ${errorMsg}`);
                break;
              case 500:
                toast.error(`服务器错误: ${errorMsg}`);
                break;
              case 401:
                toast.error(`未授权: ${errorMsg}`);
                break;
              default:
                toast.error(`上传 ${file.name} 图片时出错: ${errorMsg}`);
            }
          }
        } catch (error) {
          toast.error(`上传 ${file.name} 图片时出错`);
        }
      }

      setUploadedFilesNum(uploadedFilesNum + successCount);
      toast.success(`已成功上传 ${successCount} 张图片`);

    } catch (error) {
      console.error('上传过程中出现错误:', error);
      toast.error('上传错误');
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = (event) => {
    const clipboardItems = event.clipboardData.items;

    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      if (item.kind === 'file' && item.type.includes('image')) {
        const file = item.getAsFile();
        if (file) addFiles([file]);
        break; // 只处理第一个文件
      }
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const files = event.dataTransfer.files;

    if (files.length > 0) {
      addFiles(files);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleRemoveImage = (index) => {
    const updatedFiles = selectedFiles.filter((_, idx) => idx !== index);
    setSelectedFiles(updatedFiles);
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`链接复制成功`);
    } catch (err) {
      toast.error("链接复制失败")
    }
  };

  const handleCopyCode = async () => {
    const codeElements = parentRef.current.querySelectorAll('code');
    const values = Array.from(codeElements).map(code => code.textContent);
    try {
      await navigator.clipboard.writeText(values.join("\n"));
      toast.success(`链接复制成功`);

    } catch (error) {
      toast.error(`链接复制失败\n${error}`)
    }
  }

  const handlerenderImageClick = (imageUrl) => {
    setSelectedImage(imageUrl);
  };

  const renderFile = (data, index) => {
    if (data.type.startsWith('image/')) {
      return (
        <img
          key={`image-${index}`}
          src={data.url}
          alt={`Uploaded ${index}`}
          className="object-cover w-20 h-20 rounded-xl ring-1 ring-black/10 dark:ring-white/10 flex-shrink-0 cursor-pointer"
          onClick={() => handlerenderImageClick(data.url)}
        />
      );
    } else if (data.type.startsWith('video/')) {
      return (
        <video
          key={`video-${index}`}
          src={data.url}
          className="object-cover w-20 h-20 rounded-xl ring-1 ring-black/10 dark:ring-white/10 flex-shrink-0"
          controls
        >
          Your browser does not support the video tag.
        </video>
      );
    } else {
      return (
        <div className="w-20 h-20 rounded-xl bg-slate-200/70 dark:bg-slate-800 flex items-center justify-center text-[10px] text-slate-500 flex-shrink-0 break-all p-1">
          {data.name}
        </div>
      );
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'preview':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {uploadedImages.map((data, index) => (
              <div key={index} className="ios-card-glass rounded-2xl p-4 shadow-ios-card flex items-start gap-3.5">
                {renderFile(data, index)}
                <div className="flex flex-col justify-center flex-1 min-w-0">
                  {[
                    { text: data.url, onClick: () => handleCopy(data.url) },
                    { text: `![${data.name}](${data.url})`, onClick: () => handleCopy(`![${data.name}](${data.url})`) },
                    { text: `<a href="${data.url}" target="_blank"><img src="${data.url}"></a>`, onClick: () => handleCopy(`<a href="${data.url}" target="_blank"><img src="${data.url}"></a>`) },
                    { text: `[img]${data.url}[/img]`, onClick: () => handleCopy(`[img]${data.url}[/img]`) },
                  ].map((item, i) => (
                    <input
                      key={`input-${i}`}
                      readOnly
                      value={item.text}
                      onClick={item.onClick}
                      className="px-3 my-1 py-1.5 rounded-lg bg-white/70 dark:bg-slate-800/80 border border-black/5 dark:border-white/10 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 cursor-pointer truncate"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      case 'htmlLinks':
        return (
          <div ref={parentRef} className="ios-card-glass rounded-2xl p-4 shadow-ios-card cursor-pointer" onClick={handleCopyCode}>
            {uploadedImages.map((data, index) => (
              <div key={index} className="mb-2">
                <code className="break-all text-xs text-slate-600 dark:text-slate-300">{`<img src="${data.url}" alt="${data.name}" />`}</code>
              </div>
            ))}
          </div>
        );
      case 'markdownLinks':
        return (
          <div ref={parentRef} className="ios-card-glass rounded-2xl p-4 shadow-ios-card cursor-pointer" onClick={handleCopyCode}>
            {uploadedImages.map((data, index) => (
              <div key={index} className="mb-2">
                <code className="break-all text-xs text-slate-600 dark:text-slate-300">{`![${data.name}](${data.url})`}</code>
              </div>
            ))}
          </div>
        );
      case 'bbcodeLinks':
        return (
          <div ref={parentRef} className="ios-card-glass rounded-2xl p-4 shadow-ios-card cursor-pointer" onClick={handleCopyCode}>
            {uploadedImages.map((data, index) => (
              <div key={index} className="mb-2">
                <code className="break-all text-xs text-slate-600 dark:text-slate-300">{`[img]${data.url}[/img]`}</code>
              </div>
            ))}
          </div>
        );
      case 'viewLinks':
        return (
          <div ref={parentRef} className="ios-card-glass rounded-2xl p-4 shadow-ios-card cursor-pointer" onClick={handleCopyCode}>
            {uploadedImages.map((data, index) => (
              <div key={index} className="mb-2">
                <code className="break-all text-xs text-slate-600 dark:text-slate-300">{`${data.url}`}</code>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  const handleSelectChange = (e) => {
    setSelectedOption(e.target.value);
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  const renderButton = () => {
    if (!isAuthapi) {
      return <LoginButton href="/login">登录</LoginButton>;
    }
    switch (Loginuser) {
      case 'user':
        return <LoginButton onClick={handleSignOut}>登出</LoginButton>;
      case 'admin':
        return <LoginButton href="/admin">管理</LoginButton>;
      default:
        return <LoginButton href="/login">登录</LoginButton>;
    }
  };

  // 队列文件卡片（压缩对比）
  const renderQueueCard = (file, index) => {
    const meta = getMeta(file);
    const saving = savingPct(file);
    const hasCompressed = meta.compressedSize !== undefined && uploadMode === 'compress';
    const ext = getExt(file);
    const grad = EXT_GRADIENTS[ext] || 'from-slate-400 to-slate-500';

    return (
      <article key={index} className="ios-card-glass rounded-2xl p-4 sm:p-5 shadow-ios-card transition duration-200 hover:shadow-glass-hover">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* 图片元信息与类型徽章 */}
          <div className="flex items-center gap-3.5 w-full sm:w-auto min-w-0">
            <div className={`relative w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-tr ${grad} flex-shrink-0 flex items-center justify-center text-white font-bold shadow-inner border border-white/40`}>
              <span className="text-xs tracking-wider">{ext || 'FILE'}</span>
              <div className="absolute inset-0 bg-black/10"></div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[200px] sm:max-w-xs">
                  {file.name}
                </h4>
                {uploadMode === 'compress' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                    {hasCompressed ? (saving > 0 ? `节省 ${saving}%` : '保留原样') : '计算中…'}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 whitespace-nowrap">
                    {fmtMB(file.size)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {meta.dims ? `${meta.dims} · ` : ''}
                {uploadMode === 'compress' ? '智能转换为 WebP' : '保留原始格式'}
              </p>
            </div>
          </div>

          {/* 压缩前后体积直观对比条 */}
          {hasCompressed && saving > 0 && (
            <div className="w-full sm:w-72 bg-slate-100/70 dark:bg-slate-800/60 p-2.5 rounded-xl border border-black/5 dark:border-white/5 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-slate-400 line-through">原 {fmtMB(file.size)}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <span>新 {fmtMB(meta.compressedSize)}</span>
                  <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path clipRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" fillRule="evenodd"></path>
                  </svg>
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${100 - saving}%` }}></div>
                <div className="bg-slate-300 dark:bg-slate-600 h-full opacity-40" style={{ width: `${saving}%` }}></div>
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>压缩后体积占比 ({(100 - saving).toFixed(1)}%)</span>
                <span>已减免 {fmtMB(file.size - meta.compressedSize)}</span>
              </div>
            </div>
          )}

          {/* 移除按钮 */}
          <button
            aria-label="移除当前文件"
            className="self-end sm:self-center p-2 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
            type="button"
            onClick={() => handleRemoveImage(index)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
          </button>
        </div>
      </article>
    );
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 antialiased selection:bg-blue-500/20 selection:text-blue-600 overflow-x-hidden">
      {/* 动态背景光晕 */}
      <div aria-hidden="true" className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[720px] h-[520px] bg-gradient-to-tr from-sky-200/50 via-indigo-100/40 to-pink-200/35 dark:from-blue-900/20 dark:via-purple-900/15 dark:to-slate-900/0 rounded-full blur-3xl opacity-80"></div>
        <div className="absolute top-[45%] -left-[10%] w-[500px] h-[450px] bg-gradient-to-r from-emerald-100/40 via-teal-100/30 to-blue-100/20 dark:from-emerald-950/20 dark:to-transparent rounded-full blur-3xl opacity-70"></div>
        <div className="absolute bottom-0 -right-[10%] w-[540px] h-[540px] bg-gradient-to-l from-violet-200/30 via-indigo-100/20 to-transparent dark:from-indigo-950/25 dark:to-transparent rounded-full blur-3xl opacity-70"></div>
      </div>

      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 ios-backdrop-blur bg-white/60 dark:bg-slate-900/60 border-b border-black/[0.04] dark:border-white/[0.08] transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo 与主标题 */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/25 text-white ring-2 ring-white/60 dark:ring-white/20">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"></path>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                图床
                <span className="text-[10px] tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20">Pro</span>
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-0.5 hidden sm:block">极致轻盈 · 极速分发</p>
            </div>
          </div>
          {/* 右侧控制区 */}
          <div className="flex items-center space-x-3">
            {/* 接口快速状态胶囊 */}
            <div className="hidden md:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-200/50 dark:bg-slate-800/60 border border-black/[0.04] dark:border-white/10 text-xs font-medium text-slate-600 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{CHANNEL_LABELS[selectedOption]} 极速就绪</span>
            </div>
            <ThemeToggle />
            {renderButton()}
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 pb-36">
        <ToastContainer />

        {/* 上传配置与环境信息 */}
        <section aria-label="上传配置与环境信息" className="mb-6 ios-card-glass rounded-2xl p-4 sm:p-5 shadow-ios-card">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* 左侧：基础状态统计 */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">图片或视频上传中台</h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>文件限额 <strong className="text-slate-700 dark:text-slate-200 font-medium">5 MB</strong></span>
                <span>·</span>
                <span>全站托管 <strong className="text-blue-600 dark:text-blue-400 font-medium">{Total}</strong> 张媒体</span>
                <span>·</span>
                <span>客户端 IP: <code className="px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 font-mono text-[11px]">{IP}</code></span>
              </p>
              {uploadMode === 'compress' && (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                  <span className="whitespace-nowrap">压缩质量 {quality}%</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-40 accent-blue-500 cursor-pointer"
                  />
                </div>
              )}
            </div>
            {/* 右侧：通道切换与上传模式 */}
            <div className="flex flex-wrap items-center gap-3">
              {/* 上传通道选择器 */}
              <div className="flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-black/5 dark:border-white/5 text-xs">
                <label className="text-slate-500 dark:text-slate-400 font-medium pl-2" htmlFor="storage-node">通道:</label>
                <select
                  className="bg-transparent border-0 py-0.5 pl-1 pr-6 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-0 cursor-pointer"
                  id="storage-node"
                  value={selectedOption}
                  onChange={handleSelectChange}
                >
                  <option value="r2">Cloudflare R2</option>
                  <option value="tgchannel">TG_Channel</option>
                  <option value="tg">TG(会失效)</option>
                  <option value="58img">58img</option>
                </select>
              </div>
              {/* iOS 原生风分段控制器 */}
              <div aria-label="上传模式" className="inline-flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/70 border border-black/5 dark:border-white/5" role="tablist">
                <button
                  aria-selected={uploadMode === 'original'}
                  className={`px-3.5 py-1 text-xs rounded-lg transition ${uploadMode === 'original'
                    ? 'font-semibold bg-white dark:bg-slate-700 text-apple-blue dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-white'}`}
                  role="tab"
                  type="button"
                  onClick={() => setUploadMode('original')}
                >
                  原图上传
                </button>
                <button
                  aria-selected={uploadMode === 'compress'}
                  className={`px-3.5 py-1 text-xs rounded-lg transition ${uploadMode === 'compress'
                    ? 'font-semibold bg-white dark:bg-slate-700 text-apple-blue dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-white'}`}
                  role="tab"
                  type="button"
                  onClick={() => setUploadMode('compress')}
                >
                  压缩上传
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 拖拽与点击选取区域 */}
        <section aria-label="拖拽与点击选取区域" className="mb-8">
          <div
            className="relative group ios-card-glass rounded-3xl p-8 sm:p-12 text-center border-2 border-dashed border-blue-400/40 hover:border-blue-500/80 transition-all duration-300 cursor-pointer overflow-hidden shadow-glass hover:shadow-glass-hover"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onPaste={handlePaste}
            onClick={() => albumInputRef.current?.click()}
          >
            {/* 背景微光脉冲 */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/[0.03] to-transparent pointer-events-none group-hover:from-blue-500/[0.07] transition-colors"></div>
            <LoadingOverlay loading={uploading} />
            <div className="relative z-10 flex flex-col items-center">
              {/* iOS 图标徽章容器 */}
              <div className="w-20 h-20 mb-5 rounded-3xl bg-gradient-to-b from-white to-slate-100 dark:from-slate-800 dark:to-slate-900 shadow-md flex items-center justify-center text-apple-blue group-hover:scale-105 ios-spring-transition border border-white/60 dark:border-white/10">
                <svg className="w-10 h-10 transition-transform group-hover:-translate-y-1 duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6"></path>
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-white mb-1.5">
                拖拽图片至此，或轻触开始上传
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
                {uploadMode === 'compress'
                  ? `已开启 WebP/AVIF 智能视觉无损压缩算法，在保证超高画质的同时可显著节约高达 75% 存储与下行带宽`
                  : '支持图片与视频文件，也可直接粘贴屏幕截图；多选文件批量上传，上传后自动生成多种格式外链'}
              </p>
              {/* 快速选取药丸快捷入口 */}
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-apple-blue text-white text-xs font-medium shadow-md shadow-blue-500/20 hover:bg-apple-blueHover transition"
                  type="button"
                  onClick={(e) => { e.stopPropagation(); albumInputRef.current?.click(); }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  </svg>
                  <span>选取相册图片</span>
                </button>
                <button
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-200/70 dark:bg-slate-800/80 hover:bg-slate-300/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition"
                  type="button"
                  onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  </svg>
                  <span>拍摄拍照</span>
                </button>
                <button
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-200/70 dark:bg-slate-800/80 hover:bg-slate-300/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition"
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  </svg>
                  <span>选取文件</span>
                </button>
              </div>
            </div>
          </div>
          {/* 隐藏文件选择器：相册 / 拍照 / 任意文件 */}
          <input ref={albumInputRef} type="file" className="hidden" onChange={handleFileChange} multiple accept="image/*" />
          <input ref={cameraInputRef} type="file" className="hidden" onChange={handleFileChange} accept="image/*" capture="environment" />
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} multiple />
        </section>

        {/* 压缩效果与预备队列 */}
        {selectedFiles.length > 0 && (
          <section aria-label="压缩效果与预备队列" className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>智能压缩对比清单</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${uploadMode === 'compress'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                  {uploadMode === 'compress' ? '已启用极致减负' : '已启用原图保留'}
                </span>
              </h3>
              {uploadMode === 'compress' && selectedFiles.some(f => savingPct(f) > 0) && (
                <span className="text-xs text-slate-400">
                  平均减少 {(selectedFiles.reduce((acc, f) => acc + savingPct(f), 0) / selectedFiles.length).toFixed(1)}%
                </span>
              )}
            </div>
            {selectedFiles.map((file, index) => renderQueueCard(file, index))}
          </section>
        )}

        {/* 上传结果与外链复制 */}
        {uploadedImages.length > 0 && (
          <section aria-label="上传结果" className="mt-8 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>上传成功</span>
                <span className="px-2 py-0.5 rounded-full bg-apple-green/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                  {uploadedImages.length} 张媒体
                </span>
              </h3>
              <span className="text-xs text-slate-400">点击链接即可复制</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 px-1" role="tablist">
              {[
                { key: 'preview', label: 'Preview' },
                { key: 'htmlLinks', label: 'HTML' },
                { key: 'markdownLinks', label: 'Markdown' },
                { key: 'bbcodeLinks', label: 'BBCode' },
                { key: 'viewLinks', label: 'Links' },
              ].map(tab => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3.5 py-1.5 text-xs rounded-full transition ${activeTab === tab.key
                    ? 'bg-apple-blue text-white font-semibold shadow-sm shadow-blue-500/30'
                    : 'bg-slate-200/70 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-300/80 dark:hover:bg-slate-700'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {renderTabContent()}
          </section>
        )}
      </main>

      {/* 上传结果放大预览 */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedImage(null)}>
          <div className="relative flex flex-col items-center justify-between">
            <button
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center z-10"
              onClick={() => setSelectedImage(null)}
            >
              &times;
            </button>
            <img
              src={selectedImage}
              alt="Selected"
              className="object-contain max-w-full max-h-[85vh] rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* 快捷上传操作栏 */}
      <aside aria-label="快捷上传操作栏" className="fixed bottom-6 inset-x-4 max-w-xl md:max-w-2xl mx-auto z-40 pointer-events-none">
        <div className="pointer-events-auto ios-backdrop-blur bg-white/80 dark:bg-slate-900/80 p-2 sm:p-2.5 rounded-full shadow-dock border border-white/60 dark:border-white/10 flex items-center justify-between gap-3">
          {/* 已选数量和体积摘要 */}
          <div className="pl-4 flex items-center gap-2 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-apple-blue animate-ping flex-shrink-0"></div>
            <div className="text-xs truncate">
              <span className="font-semibold text-slate-900 dark:text-white">已选 {selectedFiles.length} 张</span>
              <span className="text-slate-400 mx-1">/</span>
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                {uploadMode === 'compress' ? '优化后' : '共'} {fmtMB(optimizedBytes)}
              </span>
            </div>
          </div>
          {/* 动作按钮区 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 清除全部 */}
            <button
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition active:scale-95"
              type="button"
              onClick={handleClear}
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
              </svg>
              <span>清空</span>
            </button>
            {/* 一键开始上传 */}
            <button
              className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-apple-blue hover:bg-apple-blueHover text-white text-xs font-semibold shadow-lg shadow-blue-500/30 transition transform active:scale-95 ${uploading || selectedFiles.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}
              type="button"
              onClick={() => handleUpload()}
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path clipRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" fillRule="evenodd"></path>
              </svg>
              <span>立即上传全部</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 页脚 */}
      <footer className="mt-auto py-8 pb-24 text-center text-xs text-slate-400 dark:text-slate-500">
        <div className="max-w-4xl mx-auto px-4 space-y-2">
          <p>
            Copyright © 2024 All rights reserved. 请勿上传违反中国法律的图片，违者后果自负。
          </p>
          <p className="flex items-center justify-center gap-2">
            <span>基于 Cloudflare Pages</span>
            <span>·</span>
            <Link className="text-apple-blue hover:underline inline-flex items-center gap-1" href="https://github.com/x-dr/telegraph-Image" rel="noopener noreferrer" target="_blank">
              <span>GitHub Telegraph-Image</span>
              <svg className="w-3 h-3 inline" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"></path>
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"></path>
              </svg>
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
