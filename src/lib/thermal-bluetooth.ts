"use client";

import { encodeEscPos } from "@/lib/thermal";

export async function printViaBluetooth(text: string): Promise<void> {
  if (!("bluetooth" in navigator)) {
    throw new Error("Bluetooth not supported on this device");
  }

  const bluetooth = navigator.bluetooth;
  if (!bluetooth) {
    throw new Error("Bluetooth not supported on this device");
  }

  const device = await bluetooth.requestDevice({
    filters: [{ services: ["000018f0-0000-1000-8000-00805f9b34fb"] }],
    optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"],
  });

  const server = await device.gatt?.connect();
  if (!server) throw new Error("Could not connect to printer");

  const services = await server.getPrimaryServices();
  const service = services[0];
  const characteristics = await service.getCharacteristics();
  const writeChar = characteristics.find(
    (c) => c.properties.write || c.properties.writeWithoutResponse
  );

  if (!writeChar) throw new Error("No writable characteristic found");

  const data = encodeEscPos(text);
  const chunkSize = 512;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    await writeChar.writeValue(chunk);
  }
}
