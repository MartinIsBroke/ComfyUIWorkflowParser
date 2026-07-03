/**
 * core-nodes.js
 *
 * A best-effort list of node "class_type" / "type" strings that ship with
 * base ComfyUI (no custom node packs required).
 *
 * ComfyUI has shipped node metadata since the Comfy Registry / Manager
 * integration landed: nodes pulled from a custom pack carry a
 * `properties.cnr_id` (and often `properties.ver`) in the saved workflow
 * JSON. When that's present, the checker trusts it completely and never
 * consults this list.
 *
 * This list only matters as a FALLBACK for workflows saved before that
 * metadata existed, or for API-format ("prompt") exports, which never
 * carry `properties` at all. It will drift out of date as ComfyUI adds
 * nodes — that's expected. Add new core node type strings below as you
 * run into false positives ("flagged as unverified but it's actually
 * core"). One string per line, comma-separated, order doesn't matter.
 */

const CORE_NODE_TYPES = new Set([
  // --- Loaders ---
  "CheckpointLoaderSimple", "CheckpointLoader", "DiffusersLoader",
  "unCLIPCheckpointLoader", "ImageOnlyCheckpointLoader",
  "LoraLoader", "LoraLoaderModelOnly",
  "VAELoader", "ControlNetLoader", "DiffControlNetLoader",
  "StyleModelLoader", "CLIPLoader", "DualCLIPLoader", "TripleCLIPLoader",
  "QuadrupleCLIPLoader", "CLIPVisionLoader", "UNETLoader",
  "UpscaleModelLoader", "GLIGENLoader", "HypernetworkLoader",
  "PhotoMakerLoader", "LoadImage", "LoadImageMask", "LoadLatent",
  "LoadAudio", "VAEDecodeAudio",

  // --- Conditioning / text encoding ---
  "CLIPTextEncode", "CLIPTextEncodeSDXL", "CLIPTextEncodeSDXLRefiner",
  "CLIPTextEncodeFlux", "CLIPTextEncodeHunyuanDiT",
  "ConditioningCombine", "ConditioningAverage", "ConditioningConcat",
  "ConditioningSetArea", "ConditioningSetAreaPercentage",
  "ConditioningSetAreaStrength", "ConditioningSetMask",
  "ConditioningZeroOut", "ConditioningSetTimestepRange",
  "unCLIPConditioning", "GLIGENTextBoxApply",
  "ControlNetApply", "ControlNetApplyAdvanced", "ControlNetApplySD3",
  "StyleModelApply", "CLIPVisionEncode", "InpaintModelConditioning",
  "PhotoMakerEncode", "FluxGuidance", "SkipLayerGuidanceSD3",
  "SkipLayerGuidanceDiT", "CFGGuider", "DualCFGGuider", "BasicGuider",
  "PerturbedAttentionGuidance", "RescaleCFG",
  "InstructPixToPixConditioning",

  // --- Sampling ---
  "KSampler", "KSamplerAdvanced", "KSamplerSelect",
  "SamplerCustom", "SamplerCustomAdvanced",
  "SamplerEulerAncestral", "SamplerEulerAncestralCFGPP", "SamplerLMS",
  "SamplerDPMPP_2M_SDE", "SamplerDPMPP_SDE", "SamplerDPMPP_2S_Ancestral",
  "SamplerDPMPP_3M_SDE", "SamplerDPMAdaptative", "SamplerLCMUpscale",
  "BasicScheduler", "KarrasScheduler", "ExponentialScheduler",
  "PolyexponentialScheduler", "VPScheduler", "BetaSamplingScheduler",
  "SDTurboScheduler", "SplitSigmas", "FlipSigmas",
  "RandomNoise", "DisableNoise",

  // --- Latent ---
  "EmptyLatentImage", "EmptySD3LatentImage", "EmptyHunyuanLatentVideo",
  "EmptyLatentAudio", "LatentUpscale", "LatentUpscaleBy",
  "LatentComposite", "LatentBlend", "LatentFromBatch",
  "RepeatLatentBatch", "LatentCrop", "LatentRotate", "LatentFlip",
  "SetLatentNoiseMask", "VAEDecode", "VAEDecodeTiled", "VAEEncode",
  "VAEEncodeTiled", "VAEEncodeForInpaint", "VAEEncodeAudio",
  "LatentAdd", "LatentSubtract", "LatentMultiply", "LatentInterpolate",
  "LatentApplyOperation", "LatentApplyOperationCFG",
  "LatentOperationTonemapReinhard", "LatentOperationSharpen",
  "RebatchLatents",

  // --- Image / mask ---
  "SaveImage", "PreviewImage", "ImageScale", "ImageScaleBy",
  "ImageInvert", "ImageBatch", "ImageBlend", "ImageBlur",
  "ImageQuantize", "ImageSharpen", "ImageCrop", "ImagePadForOutpaint",
  "ImageToMask", "MaskToImage", "ImageColorToMask",
  "ImageCompositeMasked", "ImageUpscaleWithModel", "ImageRotate",
  "ImageFlip", "ImageFromBatch", "RebatchImages", "SaveAnimatedWEBP",
  "SaveAnimatedPNG", "EmptyImage", "PorterDuffImageComposite",
  "SolidMask", "InvertMask", "CropMask", "MaskComposite",
  "FeatherMask", "GrowMask",

  // --- Model / CLIP patching & merging ---
  "ModelMergeSimple", "ModelMergeBlocks", "ModelMergeSubtract",
  "ModelMergeAdd", "CLIPMergeSimple", "CLIPMergeAdd", "CLIPMergeSubtract",
  "CLIPSetLastLayer", "FreeU", "FreeU_V2", "PatchModelAddDownscale",
  "TomePatchModel", "DifferentialDiffusion", "ModelSamplingDiscrete",
  "ModelSamplingContinuousEDM", "ModelSamplingFlux", "ModelSamplingSD3",
  "ModelSamplingStableCascade", "TorchCompileModel",

  // --- Save / utility ---
  "CheckpointSave", "CLIPSave", "VAESave", "ModelSave",
  "Note", "MarkdownNote", "PrimitiveNode", "Reroute",
]);

if (typeof module !== "undefined") {
  module.exports = { CORE_NODE_TYPES };
}
