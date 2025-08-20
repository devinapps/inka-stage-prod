import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Clock, User, Calendar, Filter, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

interface CallLog {
  id: number;
  userId: string;
  startTime: string;
  endTime: string | null;
  durationSeconds: number | null;
  date: string;
  endReason: string | null;
}

interface CallLogsResponse {
  logs: CallLog[];
  total: number;
  page: number;
  totalPages: number;
}

export function CallLogsPage() {
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  
  // Filters
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [userIdFilter, setUserIdFilter] = useState('');
  
  const { toast } = useToast();

  const fetchCallLogs = async (pageNum = 1) => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20'
      });
      
      if (dateFilter) params.append('date', dateFilter);
      if (userIdFilter) params.append('userId', userIdFilter);
      
      const response = await fetch(`/api/admin/call-logs?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch call logs');
      }
      
      const data: CallLogsResponse = await response.json();
      
      setLogs(data.logs);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
      
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách cuộc gọi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCallLogs(1);
  }, [dateFilter, userIdFilter]);

  const formatDateTime = (dateTimeStr: string) => {
    const date = new Date(dateTimeStr);
    return {
      date: date.toLocaleDateString('vi-VN'),
      time: date.toLocaleTimeString('vi-VN', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit' 
      })
    };
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getEndReasonText = (reason: string | null) => {
    switch (reason) {
      case 'user_stop': return 'Người dùng kết thúc';
      case 'user_limit_exceeded': return 'Vượt giới hạn user';
      case 'system_limit_exceeded': return 'Vượt giới hạn hệ thống';
      case 'error': return 'Lỗi hệ thống';
      default: return reason || 'Không xác định';
    }
  };

  const getStatusColor = (log: CallLog) => {
    if (!log.endTime) return 'text-blue-600 bg-blue-50';
    if (log.endReason === 'user_stop') return 'text-green-600 bg-green-50';
    if (log.endReason?.includes('limit_exceeded')) return 'text-orange-600 bg-orange-50';
    if (log.endReason === 'error') return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  const clearFilters = () => {
    setDateFilter(new Date().toISOString().split('T')[0]);
    setUserIdFilter('');
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/admin" className="inline-flex">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Quay lại Admin
            </Button>
          </Link>
        </div>
        <h1 className="text-3xl font-bold mb-2">Chi tiết cuộc gọi</h1>
        <p className="text-muted-foreground">Theo dõi thời gian start/stop của từng cuộc gọi</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Bộ lọc
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Ngày</label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">User ID</label>
              <Input
                type="text"
                placeholder="Nhập User ID..."
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={clearFilters}
                className="w-full"
              >
                Xóa bộ lọc
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="mb-4 text-sm text-muted-foreground">
        Tìm thấy {total} cuộc gọi
        {dateFilter && ` trong ngày ${new Date(dateFilter).toLocaleDateString('vi-VN')}`}
        {userIdFilter && ` của user ${userIdFilter}`}
      </div>

      {/* Call Logs Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Đang tải...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Không tìm thấy cuộc gọi nào
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-medium">ID</th>
                    <th className="text-left p-4 font-medium">User</th>
                    <th className="text-left p-4 font-medium">Ngày</th>
                    <th className="text-left p-4 font-medium">Bắt đầu</th>
                    <th className="text-left p-4 font-medium">Kết thúc</th>
                    <th className="text-left p-4 font-medium">Thời lượng</th>
                    <th className="text-left p-4 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const startDateTime = formatDateTime(log.startTime);
                    const endDateTime = log.endTime ? formatDateTime(log.endTime) : null;
                    
                    return (
                      <tr key={log.id} className="border-b hover:bg-muted/50">
                        <td className="p-4 font-mono text-sm">{log.id}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-sm">{log.userId}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{startDateTime.date}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-mono">{startDateTime.time}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          {endDateTime ? (
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-red-600" />
                              <span className="text-sm font-mono">{endDateTime.time}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-blue-600 font-medium">Đang gọi</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-mono">
                            {formatDuration(log.durationSeconds)}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(log)}`}>
                            {log.endTime ? getEndReasonText(log.endReason) : 'Đang hoạt động'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Trang {page} / {totalPages} (Tổng {total} cuộc gọi)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCallLogs(page - 1)}
              disabled={page <= 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCallLogs(page + 1)}
              disabled={page >= totalPages || loading}
            >
              Sau
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}