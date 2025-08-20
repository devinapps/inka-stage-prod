import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save, Loader2 } from "lucide-react";

interface Setting {
  id: number;
  key: string;
  value: string;
  description?: string;
  updatedAt: string;
}

export const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  const [userLimit, setUserLimit] = useState('5');
  const [totalLimit, setTotalLimit] = useState('180');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/settings');
      const data = await response.json();
      
      if (response.ok) {
        setSettings(data);
        
        // Set form values from fetched settings
        const userLimitSetting = data.find((s: Setting) => s.key === 'DAILY_USER_LIMIT_MINUTES');
        const totalLimitSetting = data.find((s: Setting) => s.key === 'DAILY_TOTAL_LIMIT_MINUTES');
        
        if (userLimitSetting) setUserLimit(userLimitSetting.value);
        if (totalLimitSetting) setTotalLimit(totalLimitSetting.value);
      } else {
        throw new Error('Failed to fetch settings');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Lỗi",
        description: "Không thể tải cài đặt hệ thống",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: string, description?: string) => {
    try {
      setUpdating(key);
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, value, description }),
      });

      if (response.ok) {
        await fetchSettings(); // Refresh settings
        toast({
          title: "Thành công",
          description: `Đã cập nhật ${key}`,
        });
      } else {
        throw new Error('Failed to update setting');
      }
    } catch (error) {
      console.error('Error updating setting:', error);
      toast({
        title: "Lỗi",
        description: `Không thể cập nhật ${key}`,
        variant: "destructive"
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleSaveUserLimit = () => {
    updateSetting('DAILY_USER_LIMIT_MINUTES', userLimit, 'Daily call limit per user in minutes');
  };

  const handleSaveTotalLimit = () => {
    updateSetting('DAILY_TOTAL_LIMIT_MINUTES', totalLimit, 'Daily total call limit for all users in minutes');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Đang tải cài đặt...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Cài đặt hệ thống</h1>
      </div>

      {/* Call Limits Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Giới hạn cuộc gọi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* User Limit */}
            <div className="space-y-2">
              <Label htmlFor="userLimit">Giới hạn theo user (phút/ngày)</Label>
              <div className="flex gap-2">
                <Input
                  id="userLimit"
                  type="number"
                  value={userLimit}
                  onChange={(e) => setUserLimit(e.target.value)}
                  placeholder="5"
                  min="1"
                  max="60"
                />
                <Button 
                  onClick={handleSaveUserLimit}
                  disabled={updating === 'DAILY_USER_LIMIT_MINUTES'}
                  size="sm"
                >
                  {updating === 'DAILY_USER_LIMIT_MINUTES' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Thời gian gọi tối đa cho mỗi user trong 1 ngày
              </p>
            </div>

            {/* Total Limit */}
            <div className="space-y-2">
              <Label htmlFor="totalLimit">Tổng giới hạn hệ thống (phút/ngày)</Label>
              <div className="flex gap-2">
                <Input
                  id="totalLimit"
                  type="number"
                  value={totalLimit}
                  onChange={(e) => setTotalLimit(e.target.value)}
                  placeholder="180"
                  min="60"
                  max="1440"
                />
                <Button 
                  onClick={handleSaveTotalLimit}
                  disabled={updating === 'DAILY_TOTAL_LIMIT_MINUTES'}
                  size="sm"
                >
                  {updating === 'DAILY_TOTAL_LIMIT_MINUTES' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Tổng thời gian gọi của tất cả user trong 1 ngày
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* All Settings Display */}
      <Card>
        <CardHeader>
          <CardTitle>Tất cả cài đặt hiện tại</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {settings.length === 0 ? (
              <p className="text-muted-foreground">Chưa có cài đặt nào</p>
            ) : (
              settings.map((setting) => (
                <div key={setting.id} className="border rounded p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{setting.key}</h3>
                      <p className="text-sm text-muted-foreground">{setting.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{setting.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(setting.updatedAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettings;