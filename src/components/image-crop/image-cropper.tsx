"use client";

import { useState, useRef } from "react";
import ReactCrop, { type Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";

interface Props {
  currentUrl?: string | null;
  onCrop: (blob: Blob) => void;
}

export function ImageCropler({ currentUrl, onCrop }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSrc(URL.createObjectURL(file));
    }
  };

  const handleCropComplete = async () => {
    const image = imgRef.current;
    if (!image || !crop) return;

    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );

    canvas.toBlob((blob) => {
      if (blob) onCrop(blob);
    }, "image/jpeg", 0.9);
  };

  return (
    <div className="space-y-2">
      <input type="file" accept="image/*" onChange={handleFile} className="text-sm" />
      {currentUrl && !src && (
        <div className="mt-2">
          <img src={currentUrl} alt="الموجودة" className="w-24 h-24 object-cover rounded-full" />
        </div>
      )}
      {src && (
        <div className="mt-2">
          <ReactCrop crop={crop} onChange={(c) => setCrop(c)} aspect={1}>
            <img ref={imgRef} src={src} alt="للقص" className="max-h-64" />
          </ReactCrop>
          <Button size="sm" className="mt-2" onClick={handleCropComplete}>تأكيد القص</Button>
        </div>
      )}
    </div>
  );
}
