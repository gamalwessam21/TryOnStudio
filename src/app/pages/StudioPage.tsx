import { useCallback, useEffect, useRef } from 'react';
import { useStudio } from '../StudioContext';
import { useCommerce } from '../CommerceContext';
import { useCamera } from '../../hooks/useCamera';
import { useDecartTryOn } from '../../features/tryon/useDecartTryOn';
import { useGestureNavigation } from '../../features/tryon/useGestureNavigation';
import { useSizeScan } from '../../features/size-scan/useSizeScan';
import { CameraMirrorPanel } from '../../features/tryon/CameraMirrorPanel';
import { GarmentSelectorPanel } from '../../features/catalog/GarmentSelectorPanel';
import { WorkflowStepsRail } from '../../features/tryon/WorkflowStepsRail';
import { SelectedOutfitCard } from '../../features/catalog/SelectedOutfitCard';
import { SizeScanPanel } from '../../features/size-scan/SizeScanPanel';
import { SizeResultCard } from '../../features/size-scan/SizeResultCard';
import { getSizeScanEligibility } from '../../utils/garmentHelpers';
import type { SwipeDirection } from '../../features/tryon/swipeDetector';

export function StudioPage() {
  const {
    categories,
    categoriesLoading,
    categoriesError,
    supportedSizes,
    reloadCatalogMeta,
    selectedCategoryId,
    setSelectedCategoryId,
    searchQuery,
    setSearchQuery,
    items,
    itemsLoading,
    itemsError,
    reloadItems,
    selectedItemId,
    selectedItemDetails,
    selectedVariant,
    detailsLoading,
    detailsError,
    outfitConfirmed,
    setOutfitConfirmed,
    selectItem,
    clearSelection,
    selectVariant,
    stepGarmentOrVariant,
    reloadSelectedDetails,
  } = useStudio();
  const {
    setLatestScannedSize,
    setSelectedPurchaseSize,
    setTryOnActiveState,
  } = useCommerce();

  const tryOn = useDecartTryOn();
  const sizeScan = useSizeScan();
  const lastCountdownSecRef = useRef<number>(3);

  const handleCameraStopped = useCallback(() => {
    tryOn.disconnectTryOn();
    sizeScan.cancelSizeScan();
    setTryOnActiveState(false);
  }, [tryOn, sizeScan, setTryOnActiveState]);

  const camera = useCamera(handleCameraStopped);

  const isTryOnStreaming = tryOn.isConnected && tryOn.hasRemoteStream;

  useEffect(() => {
    setTryOnActiveState(isTryOnStreaming);
  }, [isTryOnStreaming, setTryOnActiveState]);

  useEffect(() => {
    if (!sizeScan.scanResult) return;
    const displaySize =
      sizeScan.scanResult.borderline && sizeScan.scanResult.sizeRange
        ? sizeScan.scanResult.sizeRange
        : sizeScan.scanResult.size;
    if (displaySize) {
      setLatestScannedSize(displaySize);
    }
    const exactSize = sizeScan.scanResult.size;
    if (
      exactSize &&
      selectedItemDetails?.availableSizes?.includes(exactSize)
    ) {
      setSelectedPurchaseSize(exactSize);
    }
  }, [
    sizeScan.scanResult,
    selectedItemDetails,
    setLatestScannedSize,
    setSelectedPurchaseSize,
  ]);

  // Sync manual catalog/variant changes into an active Decart session without restarting camera
  useEffect(() => {
    if (
      tryOn.isConnected &&
      selectedItemDetails &&
      selectedVariant &&
      !detailsLoading
    ) {
      void tryOn.applyGarmentToSession(selectedItemDetails, selectedVariant);
    }
  }, [
    tryOn,
    tryOn.isConnected,
    selectedItemDetails,
    selectedVariant,
    detailsLoading,
  ]);

  const handleStepGarment = useCallback(
    async (direction: SwipeDirection) => {
      const next = await stepGarmentOrVariant(direction);
      if (next && tryOn.isConnected) {
        await tryOn.applyGarmentToSession(next.item, next.variant);
      }
    },
    [stepGarmentOrVariant, tryOn]
  );

  // MediaPipe gesture recognition runs ONLY while virtual try-on is actively streaming
  const gesture = useGestureNavigation({
    enabled: isTryOnStreaming && camera.status === 'live',
    videoRef: camera.videoRef,
    isSwitching: tryOn.tryOnStatus === 'switching_garment',
    onSwipe: (dir) => {
      void handleStepGarment(dir);
    },
  });

  const handleStartTryOn = useCallback(async () => {
    if (!selectedItemDetails || !selectedVariant) return;

    sizeScan.cancelSizeScan();
    setOutfitConfirmed(false);

    let activeStream = camera.stream;
    if (!activeStream || camera.status !== 'live') {
      activeStream = await camera.startCamera();
    }
    if (!activeStream) return;

    await tryOn.connectTryOn(activeStream, selectedItemDetails, selectedVariant);
  }, [
    selectedItemDetails,
    selectedVariant,
    sizeScan,
    setOutfitConfirmed,
    camera,
    tryOn,
  ]);

  const handleChooseOutfit = useCallback(() => {
    if (tryOn.isConnected || tryOn.isBusy) {
      tryOn.disconnectTryOn();
      setOutfitConfirmed(true);
      return;
    }
    setOutfitConfirmed(!outfitConfirmed);
  }, [tryOn, outfitConfirmed, setOutfitConfirmed]);

  const handleClearSelection = useCallback(() => {
    tryOn.disconnectTryOn();
    sizeScan.resetSizeScan();
    clearSelection();
  }, [tryOn, sizeScan, clearSelection]);

  const handleTriggerSizeScan = useCallback(
    async (countdownSec: number) => {
      if (!selectedItemDetails) return;
      const eligibility = getSizeScanEligibility(
        selectedItemDetails,
        categories
      );
      if (!eligibility.eligible) return;

      lastCountdownSecRef.current = countdownSec;

      // Always disconnect Decart before scanning so frames come from raw camera video
      if (tryOn.isConnected || tryOn.isBusy) {
        tryOn.disconnectTryOn();
      }
      setOutfitConfirmed(true);

      if (camera.status !== 'live') {
        const started = await camera.startCamera();
        if (!started) return;
      }

      await sizeScan.startSizeScan(
        selectedItemDetails.id,
        camera.videoRef.current,
        countdownSec
      );
    },
    [
      selectedItemDetails,
      categories,
      tryOn,
      setOutfitConfirmed,
      camera,
      sizeScan,
    ]
  );

  const eligibility = getSizeScanEligibility(selectedItemDetails, categories);

  const selectedLabel = selectedItemDetails
    ? `${selectedItemDetails.name}${
        selectedVariant?.colorName ? ` (${selectedVariant.colorName})` : ''
      }`
    : undefined;

  return (
    <div className="studio-page">
      {/* Top Workspace: Mirror + Catalog Selector + 7-Step Guide */}
      <div className="studio-top-grid">
        <CameraMirrorPanel
          cameraVideoRef={camera.videoRef}
          tryOnVideoRef={tryOn.tryOnVideoRef}
          cameraStatus={camera.status}
          cameraError={camera.errorMessage}
          mirrorView={camera.mirrorView}
          onToggleMirror={() => camera.setMirrorView((m) => !m)}
          onStartCamera={() => void camera.startCamera()}
          onStopCamera={camera.stopCamera}
          tryOnStatus={tryOn.tryOnStatus}
          hasRemoteStream={tryOn.hasRemoteStream}
          tryOnError={tryOn.tryOnError}
          onRetryTryOn={() => void handleStartTryOn()}
          onDisconnectTryOn={tryOn.disconnectTryOn}
          onDismissTryOnError={tryOn.clearTryOnError}
          gestureStatus={gesture.gestureStatus}
          lastGesture={gesture.lastGesture}
          onStepGarment={(dir) => void handleStepGarment(dir)}
          scanPhase={sizeScan.phase}
          countdownSeconds={sizeScan.countdownSeconds}
          capturedCount={sizeScan.capturedCount}
          totalFramesToCapture={sizeScan.totalFramesToCapture}
          selectedLabel={selectedLabel}
        />

        <GarmentSelectorPanel
          categories={categories}
          categoriesLoading={categoriesLoading}
          categoriesError={categoriesError}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          onRetryCategories={() => void reloadCatalogMeta()}
          items={items}
          itemsLoading={itemsLoading}
          itemsError={itemsError}
          onRetryItems={() => void reloadItems()}
          searchQuery={searchQuery}
          onClearSearch={() => setSearchQuery('')}
          selectedItemId={selectedItemId}
          selectedItemDetails={selectedItemDetails}
          selectedVariant={selectedVariant}
          detailsLoading={detailsLoading}
          onSelectItem={(id) => selectItem(id)}
          onSelectVariant={selectVariant}
          tryOnStatus={tryOn.tryOnStatus}
          hasRemoteStream={tryOn.hasRemoteStream}
          onStartTryOn={() => void handleStartTryOn()}
          onChooseOutfit={handleChooseOutfit}
        />

        <WorkflowStepsRail
          cameraLive={camera.status === 'live'}
          hasSelectedGarment={Boolean(selectedItemDetails && selectedVariant)}
          tryOnActive={isTryOnStreaming}
          outfitConfirmed={outfitConfirmed}
          isScanningSize={sizeScan.isScanning}
          hasSizeResult={
            sizeScan.scanResult !== null &&
            sizeScan.scannedItemId === selectedItemDetails?.id
          }
        />
      </div>

      {/* Bottom Workspace: Selected Outfit + Find My Size + Your Size */}
      <div className="studio-bottom-grid">
        <SelectedOutfitCard
          item={selectedItemDetails}
          variant={selectedVariant}
          supportedSizes={supportedSizes}
          loading={detailsLoading}
          error={detailsError}
          outfitConfirmed={outfitConfirmed}
          tryOnActive={isTryOnStreaming}
          onSelectVariant={selectVariant}
          onChooseOutfit={handleChooseOutfit}
          onClearSelection={handleClearSelection}
          onRetry={() => void reloadSelectedDetails()}
        />

        <SizeScanPanel
          item={selectedItemDetails}
          categories={categories}
          cameraLive={camera.status === 'live'}
          tryOnActive={isTryOnStreaming}
          phase={sizeScan.phase}
          countdownSeconds={sizeScan.countdownSeconds}
          countdownTotal={sizeScan.countdownTotal}
          capturedCount={sizeScan.capturedCount}
          totalFramesToCapture={sizeScan.totalFramesToCapture}
          onStartCamera={() => void camera.startCamera()}
          onTriggerScan={(sec) => void handleTriggerSizeScan(sec)}
          onCancelScan={sizeScan.cancelSizeScan}
        />

        <SizeResultCard
          item={selectedItemDetails}
          supportedSizes={supportedSizes}
          phase={sizeScan.phase}
          scanResult={sizeScan.scanResult}
          scanError={sizeScan.scanError}
          scannedItemId={sizeScan.scannedItemId}
          canRetryScan={eligibility.eligible && !sizeScan.isScanning}
          onRetryScan={() =>
            void handleTriggerSizeScan(lastCountdownSecRef.current)
          }
        />
      </div>
    </div>
  );
}

