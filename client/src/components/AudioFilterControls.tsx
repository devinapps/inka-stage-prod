import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, Volume2, Mic, Filter, RotateCcw } from "lucide-react";
import { webrtcFilters, AudioFilterParams } from "@/utils/webrtcFilters";
import { toast } from "@/hooks/use-toast";

interface AudioFilterControlsProps {
  isVisible?: boolean;
  onToggleVisibility?: () => void;
}

// Preset configurations for different scenarios
const PRESETS: { [key: string]: AudioFilterParams } = {
  conversation: {
    highPassFreq: 150,
    highPassQ: 1.2,
    speechFreq: 2500,
    speechQ: 1.5,
    speechGain: 3,
    lowPassFreq: 7000,
    lowPassQ: 1.0,
    compressorThreshold: -20,
    compressorRatio: 3,
    compressorAttack: 0.003,
    compressorRelease: 0.1,
    noiseGateThreshold: 0.015
  },
  quiet: {
    highPassFreq: 80,
    highPassQ: 0.8,
    speechFreq: 2000,
    speechQ: 1.2,
    speechGain: 2,
    lowPassFreq: 8000,
    lowPassQ: 0.8,
    compressorThreshold: -25,
    compressorRatio: 2,
    compressorAttack: 0.005,
    compressorRelease: 0.15,
    noiseGateThreshold: 0.01
  },
  noisy: {
    highPassFreq: 220,
    highPassQ: 2.0,
    speechFreq: 3000,
    speechQ: 2.0,
    speechGain: 5,
    lowPassFreq: 6500,
    lowPassQ: 1.5,
    compressorThreshold: -15,
    compressorRatio: 4,
    compressorAttack: 0.002,
    compressorRelease: 0.08,
    noiseGateThreshold: 0.025
  }
};

export default function AudioFilterControls({ isVisible = false, onToggleVisibility }: AudioFilterControlsProps) {
  const [params, setParams] = useState<AudioFilterParams>(webrtcFilters.filterParams);

  const updateParam = (key: keyof AudioFilterParams, value: number) => {
    const newParams = { ...params, [key]: value };
    setParams(newParams);
    
    // Update the WebRTC filters in real-time
    webrtcFilters.updateFilterParams({ [key]: value });
    
    console.log(`🎛️ Updated ${key}: ${value}`);
  };

  const applyPreset = (presetName: string) => {
    const preset = PRESETS[presetName];
    if (preset) {
      setParams(preset);
      webrtcFilters.updateFilterParams(preset);
      
      toast({
        title: "Preset áp dụng",
        description: `Đã áp dụng cài đặt ${presetName === 'conversation' ? 'Hội thoại' : presetName === 'quiet' ? 'Môi trường yên tĩnh' : 'Môi trường ồn'}`
      });
    }
  };

  const resetToDefault = () => {
    applyPreset('conversation');
    toast({
      title: "Đặt lại mặc định",
      description: "Đã khôi phục cài đặt mặc định cho hội thoại"
    });
  };

  if (!isVisible) {
    return (
      <Button
        onClick={onToggleVisibility}
        variant="outline"
        size="sm"
        className="fixed top-4 right-2 sm:top-10 sm:right-4 z-50 
         bg-background/80 backdrop-blur-sm
         max-w-[90%] sm:max-w-none"
        data-testid="button-show-audio-controls"
      >
        <Settings className="h-4 w-4 mr-2" />
        Điều chỉnh Audio
      </Button>
    );
  }

  return (
    <div className="fixed top-2 left-2 right-2 sm:top-4 sm:right-4 sm:left-auto
       z-50 w-full sm:w-96 max-h-[80vh] overflow-y-auto" data-testid="panel-audio-controls">
      <Card className="bg-background/95 backdrop-blur-sm shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Volume2 className="h-5 w-5" />
                Điều chỉnh Audio Filter
              </CardTitle>
              <CardDescription>
                Điều chỉnh các tham số lọc âm thanh trực tiếp
              </CardDescription>
            </div>
            <Button
              onClick={onToggleVisibility}
              variant="ghost"
              size="sm"
              data-testid="button-hide-audio-controls"
            >
              ×
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Preset Buttons */}
          <div>
            <h4 className="text-sm font-medium mb-3">Cài đặt sẵn</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => applyPreset('quiet')}
                variant="outline"
                size="sm"
                className="text-xs"
                data-testid="button-preset-quiet"
              >
                <Badge variant="secondary" className="mr-1">🤫</Badge>
                Yên tĩnh
              </Button>
              <Button
                onClick={() => applyPreset('conversation')}
                variant="outline"
                size="sm"
                className="text-xs"
                data-testid="button-preset-conversation"
              >
                <Badge variant="secondary" className="mr-1">💬</Badge>
                Hội thoại
              </Button>
              <Button
                onClick={() => applyPreset('noisy')}
                variant="outline"
                size="sm"
                className="text-xs"
                data-testid="button-preset-noisy"
              >
                <Badge variant="secondary" className="mr-1">🔊</Badge>
                Môi trường ồn
              </Button>
              <Button
                onClick={resetToDefault}
                variant="outline"
                size="sm"
                className="text-xs"
                data-testid="button-reset-default"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Mặc định
              </Button>
            </div>
          </div>

          <Separator />

          {/* High-pass Filter */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <h4 className="text-sm font-medium">High-pass Filter</h4>
            </div>
            
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>Tần số cắt</span>
                <span>{params.highPassFreq}Hz</span>
              </div>
              <Slider
                value={[params.highPassFreq]}
                onValueChange={([value]) => updateParam('highPassFreq', value)}
                min={50}
                max={500}
                step={10}
                className="w-full"
                data-testid="slider-highpass-freq"
              />
            </div>
            
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>Độ sắc nét (Q)</span>
                <span>{params.highPassQ.toFixed(1)}</span>
              </div>
              <Slider
                value={[params.highPassQ]}
                onValueChange={([value]) => updateParam('highPassQ', value)}
                min={0.1}
                max={5.0}
                step={0.1}
                className="w-full"
                data-testid="slider-highpass-q"
              />
            </div>
          </div>

          <Separator />

          {/* Speech Enhancer */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              <h4 className="text-sm font-medium">Tăng cường giọng nói</h4>
            </div>
            
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>Tần số tăng cường</span>
                <span>{params.speechFreq}Hz</span>
              </div>
              <Slider
                value={[params.speechFreq]}
                onValueChange={([value]) => updateParam('speechFreq', value)}
                min={1000}
                max={4000}
                step={100}
                className="w-full"
                data-testid="slider-speech-freq"
              />
            </div>
            
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>Mức tăng</span>
                <span>{params.speechGain}dB</span>
              </div>
              <Slider
                value={[params.speechGain]}
                onValueChange={([value]) => updateParam('speechGain', value)}
                min={0}
                max={8}
                step={0.5}
                className="w-full"
                data-testid="slider-speech-gain"
              />
            </div>
          </div>

          <Separator />

          {/* Low-pass Filter */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <h4 className="text-sm font-medium">Low-pass Filter</h4>
            </div>
            
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>Tần số cắt</span>
                <span>{params.lowPassFreq}Hz</span>
              </div>
              <Slider
                value={[params.lowPassFreq]}
                onValueChange={([value]) => updateParam('lowPassFreq', value)}
                min={4000}
                max={10000}
                step={100}
                className="w-full"
                data-testid="slider-lowpass-freq"
              />
            </div>
          </div>

          <Separator />

          {/* Compressor */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Nén âm thanh</h4>
            
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>Ngưỡng</span>
                <span>{params.compressorThreshold}dB</span>
              </div>
              <Slider
                value={[params.compressorThreshold]}
                onValueChange={([value]) => updateParam('compressorThreshold', value)}
                min={-40}
                max={-5}
                step={1}
                className="w-full"
                data-testid="slider-compressor-threshold"
              />
            </div>
            
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>Tỷ lệ nén</span>
                <span>{params.compressorRatio}:1</span>
              </div>
              <Slider
                value={[params.compressorRatio]}
                onValueChange={([value]) => updateParam('compressorRatio', value)}
                min={1}
                max={8}
                step={0.5}
                className="w-full"
                data-testid="slider-compressor-ratio"
              />
            </div>
          </div>

          <Separator />

          {/* Noise Gate */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Cổng chặn tiếng ồn</h4>
            
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>Ngưỡng mở</span>
                <span>{(params.noiseGateThreshold * 1000).toFixed(1)}</span>
              </div>
              <Slider
                value={[params.noiseGateThreshold * 1000]}
                onValueChange={([value]) => updateParam('noiseGateThreshold', value / 1000)}
                min={5}
                max={50}
                step={1}
                className="w-full"
                data-testid="slider-noise-gate-threshold"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}