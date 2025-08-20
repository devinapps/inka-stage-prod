import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, BarChart3, RefreshCw, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

export function AdminPage() {
  const [isResetting, setIsResetting] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const { toast } = useToast();

  const resetAllData = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa TẤT CẢ dữ liệu call logs? Hành động này không thể hoàn tác.')) {
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch('/api/admin/reset-data', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset data');
      }

      const result = await response.json();
      
      toast({
        title: "Thành công",
        description: `Đã xóa ${result.deletedCount} bản ghi call logs`,
      });

      // Refresh stats after reset
      loadStats();
      
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể reset dữ liệu",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const loadStats = async () => {
    setIsLoadingStats(true);
    try {
      const response = await fetch('/api/admin/usage-stats');
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        setStats({ error: 'Không thể tải thống kê' });
      }
    } catch (error) {
      setStats({ error: 'Lỗi kết nối' });
    } finally {
      setIsLoadingStats(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
        <p className="text-muted-foreground">Quản lý dữ liệu và thống kê hệ thống</p>
      </div>

      <div className="grid gap-6">
        {/* Control Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Điều khiển dữ liệu
            </CardTitle>
            <CardDescription>
              Quản lý và reset dữ liệu hệ thống
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <Button 
                variant="destructive" 
                onClick={resetAllData}
                disabled={isResetting}
                className="flex items-center gap-2"
              >
                {isResetting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {isResetting ? 'Đang xóa...' : 'Reset tất cả dữ liệu'}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={loadStats}
                disabled={isLoadingStats}
                className="flex items-center gap-2"
              >
                {isLoadingStats ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4" />
                )}
                {isLoadingStats ? 'Đang tải...' : 'Tải thống kê'}
              </Button>

              <Link href="/admin-settings">
                <Button 
                  variant="secondary" 
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Cài đặt hệ thống
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Usage Statistics */}
        {stats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Thống kê sử dụng hôm nay
              </CardTitle>
              <CardDescription>
                Ngày: {stats.date || 'N/A'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.error ? (
                <p className="text-red-500">{stats.error}</p>
              ) : (
                <div className="space-y-4">
                  {/* System Usage */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <h3 className="font-semibold mb-2">Tổng hệ thống</h3>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatTime(stats.dailyTotalSeconds || 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Còn lại: {formatTime(stats.systemRemainingSeconds || 0)} / {formatTime(stats.dailyTotalLimitSeconds || 0)}
                      </p>
                    </div>
                    
                    <div className="p-4 bg-muted rounded-lg">
                      <h3 className="font-semibold mb-2">Giới hạn mỗi user</h3>
                      <p className="text-2xl font-bold text-green-600">
                        {formatTime(stats.dailyUserLimitSeconds || 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Giới hạn hàng ngày
                      </p>
                    </div>
                  </div>

                  {/* User Statistics */}
                  {stats.userStats && stats.userStats.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3">Thống kê theo user</h3>
                      <div className="space-y-2">
                        {stats.userStats.map((user: any, index: number) => (
                          <div key={index} className="flex justify-between items-center p-3 bg-muted rounded">
                            <span className="font-medium">User {user.userId}</span>
                            <div className="text-right">
                              <span className="font-bold">{formatTime(user.totalSeconds)}</span>
                              <span className="text-sm text-muted-foreground ml-2">
                                (còn {formatTime(user.remainingSeconds)})
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}