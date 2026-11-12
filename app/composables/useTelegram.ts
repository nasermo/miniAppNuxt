interface TelegramUser {
    id: number
    first_name?: string
    last_name?: string
    username?: string
}

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
type NotifyType = 'success' | 'warning' | 'error'

const BG = '#06070b'

function webApp(): any {
    return import.meta.client ? (window as any).Telegram?.WebApp : undefined
}

/** یکپارچه‌سازی با SDK تلگرام؛ خارج از تلگرام هم بدون خطا کار می‌کند */
export function useTelegram() {
    const user = useState<TelegramUser | null>('tg-user', () => null)
    const inTelegram = useState('tg-active', () => false)

    function init() {
        const app = webApp()
        if (!app) return

        inTelegram.value = Boolean(app.initData)
        user.value = app.initDataUnsafe?.user ?? null

        try {
            app.ready()
            app.expand()
        } catch {}
        try {
            app.setHeaderColor?.(BG)
            app.setBackgroundColor?.(BG)
            app.setBottomBarColor?.(BG)
        } catch {}
        try {
            // جلوگیری از بسته‌شدن مینی‌اپ هنگام اسکرول به پایین
            app.disableVerticalSwipes?.()
        } catch {}
    }

    /** رشتهٔ initData که با هر درخواست API برای تشخیص کاربر ارسال می‌شود */
    const initData = (): string => webApp()?.initData ?? ''

    function impact(style: ImpactStyle = 'light') {
        try {
            webApp()?.HapticFeedback?.impactOccurred(style)
        } catch {}
    }

    function notify(type: NotifyType) {
        try {
            webApp()?.HapticFeedback?.notificationOccurred(type)
        } catch {}
    }

    return { user, inTelegram, init, initData, impact, notify }
}
