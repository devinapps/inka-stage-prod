import { useState } from 'react';
import { Info, X, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface InfoModalProps {
  className?: string;
  content: {
    disconnected: string;
    mainText: string;
    features: Array<{
      key: string;
      text: string;
    }>;
  };
}

const InfoModal = ({ className, content }: InfoModalProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Info Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={cn(
          "w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-accent hover:text-accent-foreground",
          className
        )}
      >
        <Info className="h-4 w-4" />
      </Button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-0 duration-200"
          onClick={handleOverlayClick}
        >
          <div className="bg-background border border-border rounded-2xl w-full max-w-md mx-auto shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="w-9" /> {/* Spacer for centering */}
              <div className="flex-1 text-center">
                <h2 className="text-lg font-semibold">Inka AI Assistant</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-full p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Description */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{content.mainText}</p>
                  
                  <div className="space-y-3 mt-4">
                    {content.features.map((feature, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                          <span className="text-sm font-semibold text-green-600">
                            {feature.key}:
                          </span>
                          <span className="text-sm text-muted-foreground ml-1">
                            {feature.text}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InfoModal;