// 应用启动时统一加载所有 workflow 注册副作用. 每个 workflow API route 顶部
// `import '@/app/bootstrap'`, Next.js module 缓存保证只执行一次.
import '@/modules/project/workflow';
import '@/modules/project/change-workflow';     // M2-T9
import '@/modules/monthly/workflow';            // M3-T5
import '@/modules/inventory/workflow';          // M4-T3
import '@/modules/trial/production-workflow';   // M5-T3
import '@/modules/trial/transfer-workflow';     // M5-T4
import '@/modules/outsource/contract-workflow'; // M5-T5
import '@/modules/closing/workflow';             // CD-T2
import '@/modules/capitalization/workflow';      // CD-T3
import '@/modules/finance/cost-allocation-workflow'; // 财务补全 #1
