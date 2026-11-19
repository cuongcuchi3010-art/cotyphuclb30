import { useState, type ReactNode } from 'react';
import { formatMoney, type BuildRule, type Rules } from '@cotyphu/shared';
import { S } from '../strings.vi';
import { cx, useGame } from '../lib';
import { Btn, Modal } from './ui';
import { LegalNotice } from './LegalNotice';

/** Nút "Luật chơi": mở bảng luật ngay trong phòng (sảnh chờ và trong ván) */
export function RulesButton({ className, label }: { className?: string; label?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Btn
        variant="ghost"
        className={className}
        title={S.guide.open}
        aria-label={S.guide.open}
        onClick={() => setOpen(true)}
      >
        📖{label && <span>{S.guide.short}</span>}
      </Btn>
      <RulesModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { room, game } = useGame();
  const rules: Rules | undefined = game?.rules ?? room?.rules;
  const free = rules?.mode === 'freestyle';
  const go = rules?.goSalary ?? 200;
  return (
    <Modal open={open} onClose={onClose} className="sm:max-w-2xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-xl font-extrabold text-son dark:text-nghe">📖 {S.guide.title}</div>
        <Btn variant="ghost" onClick={onClose} aria-label={S.guide.close}>
          ✕
        </Btn>
      </div>
      <LegalNotice className="mb-3" />
      {rules && <ThisGame rules={rules} />}
      {free && (
        <div className="mt-3 rounded-2xl bg-[#2a0f3a] p-3 text-sm text-white">
          <div className="mb-1 font-extrabold text-nghe">🎰 {S.guide.freestyle}</div>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Tiền thuê ×{String(rules?.rentMult ?? 2).replace('.', ',')}; thuế, tiền phạt và tiền
              thẻ ×{rules?.feeMult ?? 2}.
            </li>
            <li>
              Vừa mua xong được xây ngay{' '}
              {(rules?.firstBuildMax ?? 4) === 0
                ? '0 nhà (chờ lần ghé sau)'
                : `tối đa ${rules?.firstBuildMax ?? 4} nhà`}
              ; những lần dừng lại ô của mình sau đó xây tới 4 nhà (không cần trọn màu). Khách sạn
              khi ghé lại ô đã có 4 nhà. Kho nhà không giới hạn.
            </li>
            <li>Lễ hội nhân tiền thuê ngẫu nhiên ×2 đến ×5 (số nhỏ hay ra hơn).</li>
            <li>
              <b>Sòng Bạc Tiền</b> (thay EVN): người dừng ô làm nhà cái; ai muốn thì đặt cược (tối
              đa {formatMoney(Math.min(rules?.casinoMaxBet ?? 1000, 1000))}, không quá tiền nhà cái
              chia đều). Đổ cao hơn nhà cái thắng tiền cược, thấp hơn thì thua, bằng điểm thì hoà.
            </li>
            <li>
              <b>Sòng Bạc Đất</b> (thay Viettel): mỗi người đặt tối đa 1 ô của mình (nhà, khách sạn
              trên ô đi kèm), cần từ 2 người; tất cả cùng đổ, ai cao nhất lấy hết, hoà thì đổ lại.
            </li>
            <li>Ô Cà Phê (góc 20) thành ô Lễ Hội: dừng ở đó chọn 1 ô đất của mình mở lễ hội.</li>
            <li>Thẻ “Đi tới tiện ích gần nhất” thành “Đi tới Sòng Bạc gần nhất”.</li>
          </ul>
        </div>
      )}
      <div className="mt-3 space-y-2 text-sm leading-relaxed">
        <Section title="🎲 Một lượt chơi" open>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Bấm Tung xúc xắc, quân tự đi theo tổng hai xúc xắc. Qua Khởi Hành nhận{' '}
              {formatMoney(go)}.
            </li>
            <li>
              Ô chưa có chủ: <b>Mua</b> theo giá in trên ô, hoặc không mua thì cả bàn đấu giá (khởi
              điểm 10 tr, mỗi lần trả giá đếm lại 10 giây).
            </li>
            <li>Ô của người khác: tiền thuê tự chuyển, cả bàn thấy thông báo.</li>
            <li>
              Bấm <b>Kết thúc lượt</b>. Ra đôi thì tung tiếp; đôi 3 lần liên tiếp thì vào Tạm Giữ.
            </li>
          </ol>
          <p className="mt-1 text-gray-500">
            Ván mở đầu bằng bốc thăm thứ tự (30 giây); số nhỏ đi trước, theo chiều kim đồng hồ.
          </p>
        </Section>

        <Section title="💰 Tiền thuê">
          <Rows
            rows={[
              ['Đất trống', 'Theo bảng giá; chủ có trọn nhóm màu thì ×2'],
              ['Đất có nhà / khách sạn', 'Theo bảng giá (bấm vào ô để xem)'],
              ['Công ty truyền thông', '25 / 50 / 100 / 200 tr theo số công ty của chủ'],
              ['EVN, Viettel', '4 × tổng xúc xắc; có cả hai thì 10 ×'],
              ['Ô thế chấp', 'Không thu'],
              ['Ô có lễ hội', 'Nhân thêm ×2, ×3 hoặc ×4'],
            ]}
          />
        </Section>

        <Section title="🏠 Xây nhà">
          <p>
            Tối đa 4 nhà, đủ 4 nhà thì lên 1 khách sạn. Không bắt xây đều. Bán nhà nhận lại 50% giá
            xây. Ba chế độ (chủ phòng chọn ở sảnh chờ):
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {(['combined', 'color', 'landing'] as const).map((m) => (
              <div
                key={m}
                className={cx(
                  'rounded-xl p-2.5',
                  !free && (rules?.buildRule ?? 'combined') === m
                    ? 'bg-son-50 ring-2 ring-son dark:bg-son/20'
                    : 'bg-black/5 dark:bg-white/5',
                )}
              >
                <div className="font-bold">
                  {S.lobby.buildRules[m]}
                  {!free && (rules?.buildRule ?? 'combined') === m && (
                    <span className="ml-1 text-xs text-son dark:text-nghe">
                      ({S.guide.current})
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  {S.lobby.buildInfos[m]}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1 text-gray-500">
            Khi được xây, nút “🏠 Xây ở…” hiện giữa bàn. Chế độ Theo màu thì xây ở tab Tài sản hoặc
            bấm vào ô.
          </p>
        </Section>

        <Section title="🎉 Lễ hội">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Mở bằng thẻ Lễ hội
              {rules?.festivalSquare || free ? ' hoặc khi dừng ở ô Lễ Hội (góc số 20)' : ''}: chọn 1
              ô đất của mình, không thế chấp.
            </li>
            <li>Tiền thuê ô đó nhân ngẫu nhiên ×2, ×3 hoặc ×4. Ô hiện huy hiệu 🎉×N.</li>
            <li>
              Tối đa {rules?.maxFestivals ?? 3} lễ hội trên bàn; mở thêm thì lễ hội cũ nhất kết
              thúc.
            </li>
            <li>Ô đổi chủ thì lễ hội ở ô đó kết thúc.</li>
          </ul>
        </Section>

        <Section title="🃏 Ô đặc biệt & thẻ">
          <Rows
            rows={[
              [
                'Khởi Hành',
                rules?.doubleGo
                  ? `+${formatMoney(go)}; dừng đúng ô +${formatMoney(go * 2)}`
                  : `+${formatMoney(go)}`,
              ],
              ['Thuế TNCN / TTĐB', '−200 tr / −100 tr'],
              ['Vượt Đèn Đỏ', 'Vào thẳng Tạm Giữ, không qua Khởi Hành'],
              [
                'Ra Tạm Giữ',
                `Nộp ${formatMoney(free ? 50 * (rules?.feeMult ?? 2) : 50)}, dùng Thẻ Bảo Lãnh hoặc tung ra đôi; trượt 3 lần thì bắt buộc nộp`,
              ],
              [
                free || rules?.festivalSquare ? 'Lễ Hội (ô 20)' : 'Cà Phê Vỉa Hè (ô 20)',
                free || rules?.festivalSquare
                  ? 'Chọn 1 ô đất của mình mở lễ hội'
                  : rules?.jackpot
                    ? 'Nhận hết hũ tiền (thuế và phạt dồn vào hũ)'
                    : 'Nghỉ chân',
              ],
              ['Cơ Hội / Khí Vận', 'Rút 1 thẻ và làm theo'],
            ]}
          />
          <p className="mt-2">
            Thẻ phải tự chọn: <b>Cháy nhà</b> (mất 1 nhà), <b>Tranh chấp đất đai</b> (đập 1 nhà
            người khác), <b>Làm từ thiện</b> (tặng 1 ô chưa có nhà), <b>Lễ hội</b>. Hết giờ thì game
            tự chọn.
          </p>
        </Section>

        <Section title="🏦 Tiền bạc">
          <Rows
            rows={[
              [
                'Thế chấp',
                'Nhận 50% giá ô, ô thôi thu thuê; bán hết nhà trong nhóm trước; chuộc +10%',
              ],
              ['Vay ngân hàng', 'Tối đa 500 tr, lãi 10%, tự thu sau 5 lượt'],
              ['Vay người chơi', 'Tự đặt số tiền, tiền trả, số lượt; người kia đồng ý là xong'],
              ['Giao dịch', 'Chọn người, chọn ô / tiền / thẻ mỗi bên; nhận ô thế chấp trả phí 10%'],
              ['Gom tiền', 'Nợ hơn tiền đang có: bán nhà, thế chấp, vay cho đủ'],
              [
                'Phá sản',
                'Nợ người chơi: người đó nhận hết tài sản; nợ ngân hàng: đất về ngân hàng',
              ],
            ]}
          />
        </Section>

        <Section title="🏆 Thắng thua">
          <p>
            Người cuối cùng chưa phá sản thắng.
            {rules?.timeLimitMinutes
              ? ` Ván này giới hạn ${rules.timeLimitMinutes} phút: hết giờ, ai có tổng tài sản cao nhất thắng.`
              : ' Nếu đặt giới hạn thời gian, hết giờ thì ai có tổng tài sản cao nhất thắng.'}{' '}
            Tổng tài sản = tiền + giá đất + giá nhà (ô thế chấp tính nửa giá), trừ nợ, cộng khoản
            cho vay.
          </p>
        </Section>
      </div>
    </Modal>
  );
}

/** Tóm tắt luật đang áp dụng cho ván/phòng này */
function ThisGame({ rules }: { rules: Rules }) {
  const build: BuildRule = rules.buildRule ?? 'combined';
  const fs = rules.mode === 'freestyle';
  const items: [string, string][] = [
    ['Chế độ', rules.mode === 'freestyle' ? '🎰 Freestyle' : 'Cổ điển'],
    ['Tiền khởi đầu', formatMoney(rules.startingCash)],
    ['Qua Khởi Hành', formatMoney(rules.goSalary ?? 200)],
    [
      'Xây nhà',
      fs
        ? `Mua xong xây ${rules.firstBuildMax ?? 4} nhà`
        : S.lobby.buildRules[build].replace(/ \(.*\)$/, ''),
    ],
    [
      'Ô 20',
      fs
        ? 'Lễ Hội'
        : rules.festivalSquare
          ? 'Lễ Hội'
          : rules.jackpot
            ? 'Cà Phê + hũ tiền'
            : 'Cà Phê',
    ],
    ['Lễ hội tối đa', `${rules.maxFestivals ?? 3} ô`],
    ['Đấu giá', rules.auctions ? 'Có' : 'Tắt'],
    ['Khởi Hành ×2', rules.doubleGo ? 'Bật' : 'Tắt'],
    ['Thời gian ván', rules.timeLimitMinutes ? `${rules.timeLimitMinutes} phút` : 'Không giới hạn'],
    ['Đồng hồ lượt', rules.turnTimerSec ? `${rules.turnTimerSec} giây` : 'Tắt'],
    [
      'Kho nhà / khách sạn',
      fs ? 'Không giới hạn' : `${rules.houseStock ?? 32} / ${rules.hotelStock ?? 12}`,
    ],
  ];
  return (
    <div className="rounded-2xl bg-nghe-50 p-3 dark:bg-white/5">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-son dark:text-nghe">
        {S.guide.thisGame}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm sm:grid-cols-4">
        {items.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <div className="text-[11px] text-gray-500">{k}</div>
            <div className="font-semibold leading-snug">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({
  title,
  open,
  children,
}: {
  title: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={open}
      className="group rounded-2xl bg-white/80 p-3 shadow-sm dark:bg-white/5 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between font-bold">
        {title}
        <span className="text-gray-400 transition group-open:rotate-180">▾</span>
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <div className="divide-y divide-black/5 dark:divide-white/10">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[40%_1fr] gap-2 py-1.5">
          <div className="font-semibold">{k}</div>
          <div>{v}</div>
        </div>
      ))}
    </div>
  );
}
