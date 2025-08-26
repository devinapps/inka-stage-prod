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
        className="fixed z-50 
        bg-background/95 backdrop-blur-sm border-2 border-primary/20 shadow-lg
        hover:bg-primary hover:text-primary-foreground
        transition-all duration-200 ease-in-out
        
        // Mobile positioning and sizing
        top-20 right-4 
        h-12 px-4 py-3 min-w-[140px]
        text-sm font-medium
        
        // Desktop positioning and sizing  
        sm:top-20 sm:right-4
        sm:h-10 sm:px-3 sm:py-2 sm:min-w-[120px]
        sm:text-xs"
        data-testid="button-show-audio-controls"
      >
        <Settings className="h-4 w-4 mr-2 flex-shrink-0" />
        <span className="truncate">Điều chỉnh Audio</span>
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="panel-audio-controls">
      <Card className="bg-background backdrop-blur-sm shadow-2xl border-2 
                       w-[70%] h-[65%] 
                       flex flex-col
                       max-w-md max-h-[600px]
                       min-w-[300px] min-h-[400px]">
        <CardHeader className="pb-3 px-4 sm:px-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Volume2 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="truncate">Điều chỉnh Audio Filter</span>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                Điều chỉnh các tham số lọc âm thanh trực tiếp
              </CardDescription>
            </div>
            <Button
              onClick={onToggleVisibility}
              variant="ghost"
              size="sm"
              className="flex-shrink-0 h-8 w-8 sm:h-9 sm:w-9 p-0 hover:bg-destructive hover:text-destructive-foreground"
              data-testid="button-hide-audio-controls"
            >
              <span className="text-lg font-bold">×</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 px-4 sm:px-6 sm:space-y-6 flex-1 overflow-y-auto">
          {/* Preset Buttons */}
          <div>
            <h4 className="text-sm font-medium mb-3">Cài đặt sẵn</h4>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Button
                onClick={() => applyPreset('quiet')}
                variant="outline"
                className="h-10 sm:h-8 text-xs sm:text-xs px-2 sm:px-3
                hover:bg-primary hover:text-primary-foreground
                transition-colors duration-200"
                data-testid="button-preset-quiet"
              >
                <Badge variant="secondary" className="mr-1 text-xs">🤫</Badge>
                <span className="truncate">Yên tĩnh</span>
              </Button>
              <Button
                onClick={() => applyPreset('conversation')}
                variant="outline"
                className="h-10 sm:h-8 text-xs sm:text-xs px-2 sm:px-3
                bg-primary/10 border-primary/30
                hover:bg-primary hover:text-primary-foreground
                transition-colors duration-200"
                data-testid="button-preset-conversation"
              >
                <Badge variant="secondary" className="mr-1 text-xs">💬</Badge>
                <span className="truncate">Hội thoại</span>
              </Button>
              <Button
                onClick={() => applyPreset('noisy')}
                variant="outline"
                className="h-10 sm:h-8 text-xs sm:text-xs px-2 sm:px-3
                hover:bg-primary hover:text-primary-foreground
                transition-colors duration-200"
                data-testid="button-preset-noisy"
              >
                <Badge variant="secondary" className="mr-1 text-xs">🔊</Badge>
                <span className="truncate">Môi trường ồn</span>
              </Button>
              <Button
                onClick={resetToDefault}
                variant="outline"
                className="h-10 sm:h-8 text-xs sm:text-xs px-2 sm:px-3
                hover:bg-secondary hover:text-secondary-foreground
                transition-colors duration-200"
                data-testid="button-reset-default"
              >
                <RotateCcw className="h-3 w-3 mr-1 flex-shrink-0" />
                <span className="truncate">Mặc định</span>
              </Button>
            </div>
          </div>

          <Separator />

          {/* High-pass Filter */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 flex-shrink-0" />
              <h4 className="text-sm font-medium">High-pass Filter</h4>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span className="font-medium">Tần số cắt</span>
                <span className="bg-secondary px-2 py-1 rounded font-mono">{params.highPassFreq}Hz</span>
              </div>
              <Slider
                value={[params.highPassFreq]}
                onValueChange={([value]) => updateParam('highPassFreq', value)}
                min={50}
                max={500}
                step={10}
                className="w-full touch-pan-x"
                data-testid="slider-highpass-freq"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span className="font-medium">Độ sắc nét (Q)</span>
                <span className="bg-secondary px-2 py-1 rounded font-mono">{params.highPassQ.toFixed(1)}</span>
              </div>
              <Slider
                value={[params.highPassQ]}
                onValueChange={([value]) => updateParam('highPassQ', value)}
                min={0.1}
                max={5.0}
                step={0.1}
                className="w-full touch-pan-x"
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