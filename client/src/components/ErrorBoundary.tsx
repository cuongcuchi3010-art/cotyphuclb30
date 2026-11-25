import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Bắt lỗi giao diện để không bị trắng màn hình.
 * - `quiet`: lỗi ở một phần nhỏ (bảng hỏi, hiệu ứng) thì ẩn phần đó, phần còn lại vẫn chơi được.
 * - mặc định: hiện thông báo lỗi (để chụp gửi người sửa) và nút tải lại.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; quiet?: boolean; name?: string },
  { err: Error | null }
> {
  override state: { err: Error | null } = { err: null };

  static getDerivedStateFromError(err: Error) {
    return { err };
  }

  override componentDidCatch(err: Error, info: ErrorInfo) {
    console.error(`[${this.props.name ?? 'app'}]`, err, info.componentStack);
    // Vừa deploy bản mới: tệp JS cũ không còn → tự tải lại trang một lần
    if (
      /dynamically imported module|Loading chunk|Importing a module script failed/i.test(
        err.message,
      )
    ) {
      try {
        if (!sessionStorage.getItem('cotyphu:reloaded')) {
          sessionStorage.setItem('cotyphu:reloaded', '1');
          location.reload();
          return;
        }
      } catch {
        /* bỏ qua */
      }
    }
    // Phần nhỏ: thử vẽ lại sau một nhịp (dữ liệu ván cập nhật có thể đã hết lỗi)
    if (this.props.quiet) setTimeout(() => this.setState({ err: null }), 1500);
  }

  override render() {
    const { err } = this.state;
    if (!err) return this.props.children;
    if (this.props.quiet) return null;
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-4">
        <div className="max-w-md space-y-3 rounded-3xl bg-white p-5 text-center shadow-card dark:bg-[#211d16]">
          <div className="text-3xl">😵</div>
          <div className="font-bold">Có lỗi hiển thị, ván vẫn được giữ nguyên trên máy chủ.</div>
          <div className="break-words rounded-xl bg-black/5 p-2 text-left font-mono text-xs dark:bg-white/10">
            {err.message}
          </div>
          <div className="text-xs text-gray-500">Chụp màn hình này gửi người sửa game nhé.</div>
          <button
            type="button"
            className="rounded-xl bg-son px-4 py-2 font-semibold text-white"
            onClick={() => location.reload()}
          >
            Tải lại
          </button>
        </div>
      </div>
    );
  }
}
