"use client";  // 标记为客户端组件
// Next.js 14的App Router要求客户端组件使用此指令
// 客户端组件可以使用React Hooks和浏览器API

// 导入动态导入函数
// dynamic用于异步加载组件，支持懒加载
// 适用于大型组件或只在客户端使用的组件
import dynamic from 'next/dynamic';
// 导入useEffect和useState钩子
// useEffect用于处理副作用，如API调用、事件监听等
// useState用于管理组件状态
import { useEffect, useState } from 'react';
// 导入useRouter钩子
// useRouter用于路由导航和重定向
import { useRouter } from 'next/navigation';

// 动态导入MainLayout组件
// 使用dynamic函数异步加载MainLayout组件
// 这有助于减少初始加载时间
// ssr: false 表示此组件不会在服务器端渲染
// loading 表示加载时显示的内容
const MainLayout = dynamic(() => import('../components/MainLayout'), {
  ssr: false,  // 禁用服务器端渲染，因为MainLayout使用了浏览器API
  loading: () => <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Loading…</div>,  // 加载提示
});

// 主页组件
// 应用的主入口页面
// 处理登录验证和重定向逻辑
export default function Home() {
  // 初始化路由对象
  // useRouter返回路由实例，用于导航
  const router = useRouter();
  
  // 状态管理：加载状态
  // 用于控制加载提示的显示
  // 初始值为true，表示正在加载
  const [isLoading, setIsLoading] = useState(true);

  // useEffect钩子
  // 当组件挂载时执行
  // 依赖项为router，当router变化时重新执行
  useEffect(() => {
    // 检查用户是否已登录
    // 从localStorage获取token
    // localStorage是浏览器的持久化存储
    // 登录成功后，token会被存储在这里
    const token = localStorage.getItem('token');
    
    if (!token) {
      // 未登录，重定向到登录页面
      // 使用router.push()进行客户端重定向
      // 不会触发服务器请求
      router.push('/login');
    } else {
      // 已登录，继续渲染主页
      // 设置isLoading为false，隐藏加载提示
      setIsLoading(false);
    }
  }, [router]);  // 依赖项router，当router变化时重新执行

  // 如果正在加载，显示加载提示
  // 防止页面闪烁
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Checking authentication…</div>;
  }

  // 已登录，渲染MainLayout组件
  // MainLayout是应用的主布局组件
  // 包含侧边栏、消息区域和成员列表
  return <MainLayout />;
}