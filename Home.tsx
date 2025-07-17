/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import React from 'react';
import {Content, GoogleGenAI, Modality} from '@google/genai';
import {LoaderCircle, SendHorizontal, Trash2, X} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import { GradientBackground } from './components/animate-ui/backgrounds/gradient';
import { LiquidButton } from './components/animate-ui/buttons/liquid';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './components/animate-ui/base/tooltip';
import { Progress, ProgressTrack } from './components/animate-ui/base/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from './components/animate-ui/radix/dialog';
import { Paintbrush as PaintbrushIcon } from './components/animate-ui/icons/paintbrush';
import { GradientText } from './components/animate-ui/text/gradient';

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

function parseError(error: string) {
  const regex = /{"error":(.*)}/gm;
  const m = regex.exec(error);
  try {
    if (!m) return error;
    const e = m[1];
    const err = JSON.parse(e);
    return err.message || error;
  } catch (e) {
    return error;
  }
}

export default function Home() {
  const canvasRef = useRef(null);
  const backgroundImageRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#000000');
  const colorInputRef = useRef(null);
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');

  // Load background image when generatedImage changes
  useEffect(() => {
    if (generatedImage && canvasRef.current) {
      // Use the window.Image constructor to avoid conflict with Next.js Image component
      const img = new window.Image();
      img.onload = () => {
        backgroundImageRef.current = img;
        drawImageToCanvas();
      };
      img.src = generatedImage;
    }
  }, [generatedImage]);

  // Initialize canvas with white background when component mounts
  useEffect(() => {
    if (canvasRef.current) {
      initializeCanvas();
    }
  }, []);

  // Initialize canvas with white background
  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Fill canvas with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Draw the background image to the canvas
  const drawImageToCanvas = () => {
    if (!canvasRef.current || !backgroundImageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Fill with white background first
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the background image
    ctx.drawImage(
      backgroundImageRef.current,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  };

  // Get the correct coordinates based on canvas scaling
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // Calculate the scaling factor between the internal canvas size and displayed size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    // Apply the scaling to get accurate coordinates
    return {
      x:
        ('nativeEvent' in e && 'offsetX' in e.nativeEvent)
          ? (e.nativeEvent as any).offsetX * scaleX
          : (e as any).touches?.[0]?.clientX - rect.left * scaleX,
      y:
        ('nativeEvent' in e && 'offsetY' in e.nativeEvent)
          ? (e.nativeEvent as any).offsetY * scaleY
          : (e as any).touches?.[0]?.clientY - rect.top * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const {x, y} = getCoordinates(e);
    // Prevent default behavior to avoid scrolling on touch devices
    if (e.type === 'touchstart') {
      (e as React.TouchEvent<HTMLCanvasElement>).preventDefault();
    }
    // Start a new path without clearing the canvas
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    // Prevent default behavior to avoid scrolling on touch devices
    if (e.type === 'touchmove') {
      (e as React.TouchEvent<HTMLCanvasElement>).preventDefault();
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const {x, y} = getCoordinates(e);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = penColor;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    // Fill with white instead of just clearing
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setGeneratedImage(null);
    backgroundImageRef.current = null;
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPenColor(e.target.value);
  };

  const openColorPicker = () => {
    if (colorInputRef.current) {
      colorInputRef.current.click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      openColorPicker();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    setIsLoading(true);
    try {
      // Get the drawing as base64 data
      const canvas = canvasRef.current;
      // Create a temporary canvas to add white background
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error('Could not get temp canvas context');
      // Fill with white background
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      // Draw the original canvas content on top of the white background
      tempCtx.drawImage(canvas, 0, 0);
      const drawingData = tempCanvas.toDataURL('image/png').split(',')[1];

      // Create request payload
      const requestPayload = {
        prompt,
        drawingData,
        customApiKey, // Add the custom API key to the payload if it exists
      };

      // Log the request payload (without the full image data for brevity)
      console.log('Request payload:', {
        ...requestPayload,
        drawingData: drawingData
          ? `${drawingData.substring(0, 50)}... (truncated)`
          : null,
        customApiKey: customApiKey ? '**********' : null,
      });

      let contents: Content[] = [
        {
          role: 'USER',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ];

      if (drawingData) {
        contents = [
          {
            role: 'USER',
            parts: [{inlineData: {data: drawingData, mimeType: 'image/png'}}],
          },
          {
            role: 'USER',
            parts: [
              {
                text: `${prompt}. Keep the same minimal line doodle style.`,
              },
            ],
          },
        ];
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-preview-image-generation',
        contents,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      const data = {
        success: true,
        message: '',
        imageData: null as string | null,
        error: undefined as string | undefined,
      };

      if (response && response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          // Based on the part type, either get the text or image data
          if (part.text) {
            data.message = part.text;
            console.log('Received text response:', part.text);
          } else if (part.inlineData) {
            const imageData = part.inlineData.data;
            console.log('Received image data, length:', imageData?.length);
            // Include the base64 data in the response
            data.imageData = imageData ?? null;
          }
        }
      }

      // Log the response (without the full image data for brevity)
      console.log('Response:', {
        ...data,
        imageData: data.imageData && typeof data.imageData === 'string'
          ? `${data.imageData.substring(0, 50)}... (truncated)`
          : null,
      });

      if (data.success && typeof data.imageData === 'string') {
        const imageUrl = `data:image/png;base64,${data.imageData}`;
        setGeneratedImage(imageUrl);
      } else {
        console.error('Failed to generate image:', data.error);
        alert('Failed to generate image. Please try again.');
      }
    } catch (error: any) {
      console.error('Error submitting drawing:', error);
      setErrorMessage(error.message || 'An unexpected error occurred.');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Close the error modal
  const closeErrorModal = (e: any) => {
    setShowErrorModal(false);
  };

  // Handle the custom API key submission
  const handleApiKeySubmit = (e) => {
    e.preventDefault();
    setShowErrorModal(false);
    // Will use the customApiKey state in the next API call
  };

  // Add touch event prevention function
  useEffect(() => {
    // Function to prevent default touch behavior on canvas
    const preventTouchDefault = (e) => {
      if (isDrawing) {
        e.preventDefault();
      }
    };

    // Add event listener when component mounts
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('touchstart', preventTouchDefault, {
        passive: false,
      });
      canvas.addEventListener('touchmove', preventTouchDefault, {
        passive: false,
      });
    }

    // Remove event listener when component unmounts
    return () => {
      if (canvas) {
        canvas.removeEventListener('touchstart', preventTouchDefault);
        canvas.removeEventListener('touchmove', preventTouchDefault);
      }
    };
  }, [isDrawing]);

  return (
    <GradientBackground className="min-h-screen w-full flex flex-col items-center justify-start">
      <TooltipProvider>
        <main className="container mx-auto px-3 sm:px-6 py-5 sm:py-10 pb-32 max-w-5xl w-full">
          {/* Header section with title and tools */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-2 sm:mb-6 gap-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-0 leading-tight font-mega">
                <GradientText text="Gemini Co-Drawing" />
              </h1>
              <p className="text-sm sm:text-base text-gray-100 mt-1">
                Built with{' '}
                <a
                  className="underline"
                  href="https://ai.google.dev/gemini-api/docs/image-generation"
                  target="_blank"
                  rel="noopener noreferrer">
                  Gemini 2.0 native image generation
                </a>
              </p>
              <p className="text-sm sm:text-base text-gray-100 mt-1">
                by{' '}
                <a
                  className="underline"
                  href="https://x.com/trudypainter"
                  target="_blank"
                  rel="noopener noreferrer">
                  @trudypainter
                </a>{' '}
                and{' '}
                <a
                  className="underline"
                  href="https://x.com/alexanderchen"
                  target="_blank"
                  rel="noopener noreferrer">
                  @alexanderchen
                </a>
              </p>
            </div>
            <menu className="flex items-center bg-white/20 rounded-full p-2 shadow-sm self-start sm:self-auto gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <LiquidButton
                    type="button"
                    size="icon"
                    variant="secondary"
                    onClick={openColorPicker}
                    aria-label="Open color picker"
                    style={{ backgroundColor: penColor }}
                  >
                    <PaintbrushIcon size={24} />
                  </LiquidButton>
                </TooltipTrigger>
                <TooltipContent>Pick pen color</TooltipContent>
              </Tooltip>
              <input
                ref={colorInputRef}
                type="color"
                value={penColor}
                onChange={handleColorChange}
                className="opacity-0 absolute w-px h-px"
                aria-label="Select pen color"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <LiquidButton
                    type="button"
                    size="icon"
                    variant="secondary"
                    onClick={clearCanvas}
                    aria-label="Clear Canvas"
                  >
                    <Trash2 className="w-5 h-5 text-gray-700" />
                  </LiquidButton>
                </TooltipTrigger>
                <TooltipContent>Clear canvas</TooltipContent>
              </Tooltip>
            </menu>
          </div>
          {/* Canvas section */}
          <div className="w-full mb-6">
            <canvas
              ref={canvasRef}
              width={960}
              height={540}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="border-2 border-black w-full hover:cursor-crosshair sm:h-[60vh] h-[30vh] min-h-[320px] bg-white/90 touch-none rounded-xl shadow-lg"
            />
          </div>
          {/* Input form that matches canvas width */}
          <form onSubmit={handleSubmit} className="w-full">
            <div className="relative">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your vision..."
                className="w-full p-3 sm:p-4 pr-12 sm:pr-14 text-sm sm:text-base border-2 border-black bg-white text-gray-800 shadow-sm focus:ring-2 focus:ring-gray-200 focus:outline-none transition-all font-mono rounded-xl"
                required
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2">
                    <LiquidButton
                      type="submit"
                      size="icon"
                      variant="default"
                      disabled={isLoading}
                      aria-label="Submit"
                    >
                      {isLoading ? (
                        <Progress value={70} className="w-6 h-6" />
                      ) : (
                        <SendHorizontal className="w-5 sm:w-6 h-5 sm:h-6" />
                      )}
                    </LiquidButton>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Generate with Gemini</TooltipContent>
              </Tooltip>
            </div>
          </form>
        </main>
        {/* Error Modal */}
        <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
          <DialogContent from="top">
            <DialogHeader>
              <DialogTitle>Failed to generate</DialogTitle>
            </DialogHeader>
            <DialogDescription>{parseError(errorMessage)}</DialogDescription>
            <DialogClose asChild>
              <LiquidButton variant="secondary" size="default" aria-label="Close">
                Close
              </LiquidButton>
            </DialogClose>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </GradientBackground>
  );
}
