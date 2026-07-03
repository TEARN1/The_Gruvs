import { FeedManager } from '../services/dataFlow';
import React, { useState, useRef, useCallback } from 'react';
import { useDraft } from '../hooks/useDraft';
import {
  Modal, View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image, Dimensions,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import * as Location from 'expo-location';
import { LocationService } from '../services/locationService';
import * as ImagePicker from 'expo-image-picker';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { uploadToStorage } from '../services/storageService';
import { CategoryPickerModal } from './CategoryPickerModal';
import { CompetitionPicker } from './CompetitionPicker';
import { ALL_CATEGORIES_MAP } from '../constants/AllCategories';
import { VibeEquityLedger } from '../services/vibeEquityLedger';
import { CalendarPicker, TimePicker } from './DateTimePickers';
import { useBackClose } from '../hooks/useBackClose';
import { money } from '../constants/currencies';
import { EVENT_TAGS } from '../constants/EventTags';
import { COMMUNITY_TAG_GROUPS, GENDER_OPTIONS, LANGUAGE_OPTIONS, describeAudience, hasAudienceTargeting } from '../constants/AudienceTargeting';
import { rateContent } from '../utils/contentAgeRating';

const SCREEN_W = Dimensions.get('window').width;

const MAX_MEDIA = 30;
const EVENT_TYPES = ['Social', 'Concert', 'Workshop', 'Festival', 'Meetup', 'Party', 'Conference', 'Pop-Up', 'Rave', 'Market', 'Retreat', 'Competition'];
const AGE_MIN_OPTIONS = [0, 13, 16, 18, 21, 25, 30, 35];
const AGE_MAX_OPTIONS = [0, 17, 20, 25, 30, 35, 45, 99]; // 0 = no upper limit

export const PostEventModal = ({ visible, onClose, onPostSuccess, onCreated }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();

  // Form fields
  const [title, setTitle] = useState('');
  // Poster mode: the uploaded poster already carries all the details, so the
  // manual text fields become optional and the event renders as a full poster.
  const [posterMode, setPosterMode] = useState(false);
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pickedDate, setPickedDate] = useState(null);      // Date object
  const [endDate, setEndDate] = useState(null);            // optional end date (multi-day events)
  const [endCalendarVisible, setEndCalendarVisible] = useState(false);
  const [pickedHour, setPickedHour] = useState(20);
  const [pickedMinute, setPickedMinute] = useState(0);
  const [timeSet, setTimeSet] = useState(false);
  const [ticketUrl, setTicketUrl] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [powerBackup, setPowerBackup] = useState(null);
  const [secretAct, setSecretAct] = useState('');
  const [revealThreshold, setRevealThreshold] = useState('');
  const [showSecretHelpText, setShowSecretHelpText] = useState(false);
  const [eventTags, setEventTags] = useState([]);
  const [vipPrice, setVipPrice] = useState('');
  const [vvipPrice, setVvipPrice] = useState('');
  // Flexible named tiers — phases (Early Bird/Phase 1/2) and rows/zones
  // (Golden Circle, Standing, Seated...). Each: { name, price }.
  const [extraTiers, setExtraTiers] = useState([]);
  const [otherTickets, setOtherTickets] = useState('');
  const [eventType, setEventType] = useState('');
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [ageMin, setAgeMin] = useState(0);
  const [ageMax, setAgeMax] = useState(0);
  // ── Audience targeting ── who exactly is this event for? (events.audience JSONB)
  const [audGenders, setAudGenders] = useState([]);       // ['female', ...]
  const [audTags, setAudTags] = useState([]);             // community_tags
  const [audLanguages, setAudLanguages] = useState([]);
  const [audClans, setAudClans] = useState('');           // comma-separated free text
  const [audSurnames, setAudSurnames] = useState('');
  const [audCareers, setAudCareers] = useState('');       // professions, comma-separated
  const [audVillages, setAudVillages] = useState('');
  const [audRadiusKm, setAudRadiusKm] = useState(0);      // 0 = anywhere
  const [audMatchAll, setAudMatchAll] = useState(false);  // false = ANY (OR), true = ALL (AND)
  const [showTargeting, setShowTargeting] = useState(false);
  const [endHour, setEndHour] = useState(null);
  const [endMinute, setEndMinute] = useState(null);
  const [endTimeSet, setEndTimeSet] = useState(false);
  const [endTimePickerVisible, setEndTimePickerVisible] = useState(false);
  // Recurrence
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('weekly'); // weekly|monthly|annually|custom
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDays, setRecurrenceDays] = useState([]); // 0-6 day-of-week for weekly
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(null);
  const [recurrenceEndCalendarVisible, setRecurrenceEndCalendarVisible] = useState(false);
  const [customDates, setCustomDates] = useState([]); // Date[] for custom
  const [customDateCalendarVisible, setCustomDateCalendarVisible] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [mediaItems, setMediaItems] = useState([]); // { uri, type, name, mimeType }
  const [scheduleItems, setScheduleItems] = useState([]); // { id, time, title, performer, notes }
  const [scheduleFormVisible, setScheduleFormVisible] = useState(false);
  const [competitionId, setCompetitionId] = useState(null); // optional tournament link
  const [scheduleForm, setScheduleForm] = useState({ time: '', title: '', performer: '', notes: '', day: 1 });
  const [loading, setLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [error, setError] = useState('');
  const [catPickerVisible, setCatPickerVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [step, setStep] = useState(1);
  // Back steps through the wizard before closing it.
  useBackClose(visible, () => { if (step > 1) setStep((prev) => prev - 1); else onClose(); });
  const scrollRef = useRef(null);
  const titleRef = useRef(null);
  const descriptionRef = useRef(null);
  const addressRef = useRef(null);
  const dateRef = useRef(null);
  // Tracks the Y offset of each required field within the ScrollView
  const fieldY = useRef({});

  const primary = currentTheme?.primary || "#00f2ff";
  const bg = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';

  // Drafts: autosave the event form so an interruption never wipes your work.
  const restoreDraft = (d) => {
    if (typeof d.title === 'string') setTitle(d.title);
    if (typeof d.posterMode === 'boolean') setPosterMode(d.posterMode);
    if (typeof d.description === 'string') setDescription(d.description);
    if (typeof d.address === 'string') setAddress(d.address);
    if (typeof d.city === 'string') setCity(d.city);
    if (typeof d.ticketUrl === 'string') setTicketUrl(d.ticketUrl);
    if (typeof d.contactPhone === 'string') setContactPhone(d.contactPhone);
    if (typeof d.contactEmail === 'string') setContactEmail(d.contactEmail);
    if (typeof d.entryPrice === 'string') setEntryPrice(d.entryPrice);
    if (typeof d.vipPrice === 'string') setVipPrice(d.vipPrice);
    if (typeof d.vvipPrice === 'string') setVvipPrice(d.vvipPrice);
    if (typeof d.otherTickets === 'string') setOtherTickets(d.otherTickets);
    if (Array.isArray(d.extraTiers)) setExtraTiers(d.extraTiers.filter(t => t && typeof t === 'object'));
    if (typeof d.eventType === 'string') setEventType(d.eventType);
    if (typeof d.ageMin === 'number') setAgeMin(d.ageMin);
    if (typeof d.ageMax === 'number') setAgeMax(d.ageMax);
    if (Array.isArray(d.selectedCategories)) setSelectedCategories(d.selectedCategories);
    if (Array.isArray(d.scheduleItems)) setScheduleItems(d.scheduleItems);
    if (d.competitionId) setCompetitionId(d.competitionId);
    if (d.endDate) { const ed = new Date(d.endDate); if (!isNaN(ed.getTime())) setEndDate(ed); }
  };
  const { clearDraft } = useDraft(
    user ? `draft:event:${user.id}` : null,
    () => ({ title, description, address, city, ticketUrl, contactPhone, contactEmail, entryPrice, vipPrice, vvipPrice, otherTickets, extraTiers, eventType, ageMin, ageMax, selectedCategories, scheduleItems, competitionId, endDate: endDate ? endDate.toISOString() : null }),
    restoreDraft,
    { enabled: visible && !!user },
  );

  const reset = () => {
    setTitle(''); setPosterMode(false); setDescription(''); setAddress(''); setCity('');
    setPickedDate(null); setEndDate(null); setPickedHour(20); setPickedMinute(0); setTimeSet(false);
    setTicketUrl(''); setEntryPrice(''); setVipPrice(''); setVvipPrice(''); setOtherTickets(''); setExtraTiers([]); setEventType('');
    setContactPhone(''); setContactEmail('');
    setLat(null); setLon(null);
    setAgeMin(0); setAgeMax(0); setSelectedCategories([]); setMediaItems([]);
    setAudGenders([]); setAudTags([]); setAudLanguages([]); setAudClans(''); setAudSurnames(''); setAudCareers('');
    setAudVillages(''); setAudRadiusKm(0); setAudMatchAll(false); setShowTargeting(false);
    setEndHour(null); setEndMinute(null); setEndTimeSet(false); setEndTimePickerVisible(false);
    setScheduleItems([]); setScheduleFormVisible(false);
    setScheduleForm({ time: '', title: '', performer: '', notes: '', day: 1 });
    setIsRecurring(false); setRecurrenceType('weekly'); setRecurrenceInterval(1);
    setRecurrenceDays([]); setRecurrenceEndDate(null); setCustomDates([]);
    setStep(1);
    setLoading(false); setUploadingMedia(false); setError('');
    setCalendarVisible(false); setTimePickerVisible(false);
  };

  const handleClose = () => { reset(); onClose(); };

  // ── Auto-geocode address → lat/lon when user stops typing ────────────────
  const geocodeTimer = useRef(null);
  const [geocoding, setGeocoding] = useState(false);

  // Forward-geocode an address string -> { lat, lon } | null.
  // IMPORTANT: Location.geocodeAsync does NOT exist on web, so web must use
  // Nominatim. (The old code only hit Nominatim when permission was denied, so
  // on web — where permission is usually granted — it threw and saved no coords,
  // which is why most web-posted events had null lat/lon.)
  const resolveCoords = useCallback(async (addressText) => {
    if (!addressText || addressText.trim().length < 4) return null;
    const query = city.trim() ? `${addressText.trim()}, ${city.trim()}` : addressText.trim();
    // Native: try the on-device geocoder first (no GPS permission needed for a
    // forward address lookup, but some platforms gate it — fall through on error).
    if (Platform.OS !== 'web') {
      try {
        const results = await Location.geocodeAsync(query);
        if (results?.length) return { lat: results[0].latitude, lon: results[0].longitude };
      } catch { /* fall through to Nominatim */ }
    }
    // Web + native fallback: Nominatim open geocoding.
    try {
      const encoded = encodeURIComponent(query);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`, {
        headers: { 'Accept': 'application/json' },
      });
      const json = await res.json();
      if (json?.length) {
        const la = parseFloat(json[0].lat), lo = parseFloat(json[0].lon);
        if (Number.isFinite(la) && Number.isFinite(lo)) return { lat: la, lon: lo };
      }
    } catch { /* best-effort */ }
    return null;
  }, [city]);

  const geocodeAddress = useCallback(async (addressText) => {
    setGeocoding(true);
    const c = await resolveCoords(addressText);
    if (c) { setLat(c.lat); setLon(c.lon); }
    setGeocoding(false);
  }, [resolveCoords]);

  // Debounced geocode: fires 1.5s after user stops typing
  const handleAddressChange = useCallback((v) => {
    setAddress(v);
    if (error) setError('');
    if (lat && lon) return; // skip if user already manually pinned
    clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => geocodeAddress(v), 1500);
  }, [error, lat, lon, geocodeAddress]);

  const pinLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is required to pin the Spot.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      setLat(loc.coords.latitude);
      setLon(loc.coords.longitude);
    } catch (e) {
      setError('Could not get precise location fix.');
    }
  };

  // ── Media picker ─────────────────────────────────────────────────────────
  const pickMedia = async () => {
    if (mediaItems.length >= MAX_MEDIA) {
      setError(`Maximum ${MAX_MEDIA} media items allowed.`);
      return;
    }
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('Photo library access is required to upload media.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: MAX_MEDIA - mediaItems.length,
      quality: 0.85,
    });
    if (!result.canceled && result.assets) {
      const newItems = result.assets.map(a => ({
        uri: a.uri,
        type: a.type || (a.uri.includes('.mp4') || a.uri.includes('.mov') ? 'video' : 'image'),
        name: a.fileName || `media_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        mimeType: a.mimeType || undefined,
      }));
      setMediaItems(prev => [...prev, ...newItems].slice(0, MAX_MEDIA));
    }
  };

  const removeMedia = (index) => {
    setMediaItems(prev => prev.filter((_, i) => i !== index));
  };

  // ── Upload all media to Supabase Storage ─────────────────────────────────
  const uploadAllMedia = async () => {
    const uploaded = [];
    const failed = [];
    for (const item of mediaItems) {
      try {
        // Normalize extension — strip query params and get last segment
        const cleanUri = item.uri.split('?')[0];
        let ext = (cleanUri.split('.').pop() || 'jpg').toLowerCase();
        // expo-image-picker sometimes returns content:// URIs without extension
        if (!ext || ext.length > 5) ext = item.type === 'video' ? 'mp4' : 'jpg';
        const fileName = `${user.id}/events/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const mimeType = item.mimeType
          || (item.type === 'video' ? (ext === 'mov' ? 'video/quicktime' : 'video/mp4') : `image/${ext === 'jpg' ? 'jpeg' : ext}`);
        const publicUrl = await uploadToStorage(item.uri, 'event-media', fileName, { mimeType });
        uploaded.push({ url: publicUrl, type: item.type });
      } catch (e) {
        failed.push(e.message || 'Upload failed');
      }
    }
    if (uploaded.length === 0 && failed.length > 0) {
      // Surface the most actionable error message
      const firstErr = failed[0] || '';
      if (firstErr.includes('Bucket not found') || firstErr.includes('bucket')) {
        throw new Error(
          'Storage not set up yet. Run supabase/patch_storage_media.sql in the Supabase SQL Editor (Dashboard → SQL Editor), then try again.'
        );
      }
      if (firstErr.includes('not authorized') || firstErr.includes('policy')) {
        throw new Error('Upload blocked by storage policy. Make sure you are signed in and storage policies are applied.');
      }
      throw new Error(`Media upload failed: ${firstErr}`);
    }
    if (failed.length > 0) {
      setError(`${failed.length} of ${mediaItems.length} files failed to upload — posting with ${uploaded.length} file(s).`);
    }
    return uploaded;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const scrollAndFocus = (fieldKey, ref) => {
    const y = fieldY.current[fieldKey] ?? 0;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
    setTimeout(() => ref?.current?.focus(), 320);
  };

  const handlePost = async () => {
    if (!title.trim()) {
      setError('Event title is required — give your Gruv a name.');
      scrollAndFocus('title', titleRef);
      return;
    }
    if (!posterMode && !address.trim()) {
      setError('Venue / address is required so people know where to show up.');
      scrollAndFocus('address', addressRef);
      return;
    }
    if (!pickedDate) {
      setError('Pick a date so people can plan ahead.');
      scrollAndFocus('date', dateRef);
      return;
    }
    if (posterMode && mediaItems.length === 0) {
      setError('Upload your poster — in poster mode it carries all the details.');
      setStep(2);
      return;
    }
    if (!user?.id) { setError('Sign in required to post a Gruv.'); return; }

    setLoading(true);
    setError('');

    try {
    let mediaUrls = [];
    if (mediaItems.length > 0) {
      setUploadingMedia(true);
      try {
        mediaUrls = await uploadAllMedia();
      } catch (uploadErr) {
        setUploadingMedia(false);
        setError(`Media upload failed: ${uploadErr.message || 'Unknown error'}. Fix the storage issue or remove the photos and try again.`);
        setLoading(false);
        return;
      }
      setUploadingMedia(false);
    }

    // Use first selected category as the event category key.
    // Map sub-categories (e.g. 'afrobeats') to their parent CATEGORY_CONFIG key
    // (e.g. 'music') so the feed filter finds them.
    const rawCat = selectedCategories[0] || eventType?.toLowerCase() || null;
    const GROUP_TO_CAT = {
      'Music':'music','Nightlife':'nightlife','Sport':'sport','Arts & Culture':'art',
      'Food & Drink':'food','Gaming':'gaming','Education':'edu','Business':'biz',
      'Dance':'dance','Fitness & Wellness':'wellness','Fashion & Beauty':'fashion',
      'Travel':'travel','Technology':'gaming','Science':'science','Faith':'religion',
      'Family':'kids','Civic':'politics','Social':'dating','Health':'health',
      'Markets':'market','Cars & Motors':'cars','Books & Writing':'books',
      'Hobbies':'crafts','Virtual':'virtual',
    };
    const catGroup = rawCat && ALL_CATEGORIES_MAP[rawCat]?.group;
    const primaryCat = (catGroup && GROUP_TO_CAT[catGroup]) || rawCat;

    // Safety net: if the debounced geocode hasn't resolved yet (or the user typed
    // fast and hit Post), resolve coordinates synchronously now so the event isn't
    // saved without a location (which would hide it from Scout + "near you").
    let finalLat = lat, finalLon = lon;
    if ((finalLat == null || finalLon == null) && (address.trim() || city.trim())) {
      const c = await resolveCoords(address.trim() || city.trim());
      if (c) { finalLat = c.lat; finalLon = c.lon; setLat(c.lat); setLon(c.lon); }
    }
    // Last resort (poster-mode / blank or unresolvable address): use the host's
    // current location so the event still appears on Scout + "near you". Try the
    // cached fix first (no prompt); only ask for GPS if nothing is cached yet.
    if (finalLat == null || finalLon == null) {
      let coords = LocationService.getCached?.();
      if (!coords?.lat) { try { coords = await LocationService.requestAndGet(); } catch { /* denied/offline */ } }
      if (coords?.lat != null && coords?.lon != null) {
        finalLat = coords.lat; finalLon = coords.lon; setLat(coords.lat); setLon(coords.lon);
      }
    }

    const payload = {
      author_id: user?.id,
      title: title.trim(),
      // In poster mode the text fields are optional — fall back so NOT NULL
      // columns are still satisfied while the poster carries the real details.
      description: description.trim() || (posterMode ? 'See poster for details.' : ''),
      address: address.trim() || (posterMode ? 'See poster' : ''),
      lat: finalLat,
      lon: finalLon,
      status: 'published',
    };
    if (posterMode) payload.poster_mode = true;
    // coords: only set if PostGIS available — computed from lat/lon
    if (city.trim()) payload.city = city.trim();
    if (powerBackup) payload.power_backup = powerBackup;
    if (eventTags.length > 0) payload.tags = eventTags;
    if (secretAct.trim()) { payload.secret_act = secretAct.trim(); payload.secret_reveal_threshold = parseInt(revealThreshold) || 25; }
    if (pickedDate) {
      const y = pickedDate.getFullYear();
      const mo = String(pickedDate.getMonth() + 1).padStart(2, '0');
      const d = String(pickedDate.getDate()).padStart(2, '0');
      payload.event_date = `${y}-${mo}-${d}`;
    }
    if (timeSet) {
      payload.event_time = `${String(pickedHour).padStart(2, '0')}:${String(pickedMinute).padStart(2, '0')}`;
    }
    if (mediaUrls.length > 0) {
      payload.media = mediaUrls;
      payload.media_urls = mediaUrls.map(m => m.url);
      payload.cover_url = mediaUrls[0].url;
    }
    if (endDate && pickedDate) {
      const ey = endDate.getFullYear();
      const emo = String(endDate.getMonth() + 1).padStart(2, '0');
      const ed = String(endDate.getDate()).padStart(2, '0');
      const endStr = `${ey}-${emo}-${ed}`;
      if (endStr > payload.event_date) payload.end_date = endStr; // multi-day, only if after start
    }
    if (scheduleItems.length > 0) payload.schedule = scheduleItems.map(({ id, ...rest }) => rest);
    if (competitionId) payload.competition_id = competitionId;
    if (ageMin > 0) payload.age_restriction = ageMin;
    if (ageMax > 0) payload.age_max = ageMax;

    // Auto age-rating from the listing text (silently raises the viewing floor;
    // the host's own age_restriction can only push it higher). Optional column —
    // the Tier-3 insert omits it, so the event still posts if it isn't migrated.
    const _rating = rateContent(`${title} ${description}`, { declaredAgeRestriction: ageMin });
    payload.min_age = _rating.minAge;
    if (_rating.escalate) payload.auto_flagged = true;

    // Audience targeting — who exactly is this event for? (stored as JSONB)
    const csv = (s) => s.split(',').map(v => v.trim()).filter(Boolean);
    const audience = {};
    if (ageMin > 0) audience.age_min = ageMin;
    if (ageMax > 0) audience.age_max = ageMax;
    if (audGenders.length) audience.genders = audGenders;
    if (audTags.length) audience.community_tags = audTags;
    if (audLanguages.length) audience.languages = audLanguages;
    if (csv(audClans).length) audience.clans = csv(audClans);
    if (csv(audSurnames).length) audience.surnames = csv(audSurnames);
    if (csv(audCareers).length) audience.careers = csv(audCareers);
    if (csv(audVillages).length) audience.villages = csv(audVillages);
    if (audRadiusKm > 0) audience.radius_km = audRadiusKm;
    if (Object.keys(audience).length) {
      audience.match_mode = audMatchAll ? 'all' : 'any';
      payload.audience = audience;
    }
    if (endTimeSet && endHour !== null) {
      payload.end_time = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
    }
    if (primaryCat) payload.category = primaryCat;
    if (selectedCategories.length > 0) payload.categories = selectedCategories;
    if (ticketUrl.trim()) payload.ticket_url = ticketUrl.trim();
    if (contactPhone.trim()) payload.contact_phone = contactPhone.trim();
    if (contactEmail.trim()) payload.contact_email = contactEmail.trim();

    // Recurrence
    if (isRecurring) {
      payload.is_recurring = true;
      payload.recurrence_type = recurrenceType;
      payload.recurrence_interval = recurrenceInterval;
      if (recurrenceType === 'weekly' && recurrenceDays.length > 0) {
        payload.recurrence_days = recurrenceDays;
      }
      if (recurrenceEndDate) {
        const y = recurrenceEndDate.getFullYear();
        const mo = String(recurrenceEndDate.getMonth() + 1).padStart(2, '0');
        const d = String(recurrenceEndDate.getDate()).padStart(2, '0');
        payload.recurrence_end_date = `${y}-${mo}-${d}`;
      }
      if (recurrenceType === 'custom' && customDates.length > 0) {
        payload.recurrence_dates = customDates.map(d => {
          const y = d.getFullYear();
          const mo = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${y}-${mo}-${dd}`;
        });
      }
      // next_occurrence is the start date itself for new series
      if (pickedDate) {
        const y = pickedDate.getFullYear();
        const mo = String(pickedDate.getMonth() + 1).padStart(2, '0');
        const d = String(pickedDate.getDate()).padStart(2, '0');
        payload.next_occurrence = `${y}-${mo}-${d}`;
      }
    }

    // Ticket Tiers & Prices
    let computedPrice = 'FREE';
    let minP = null;
    let maxP = null;

    const parsedEntry = entryPrice.trim() ? parseFloat(entryPrice) : null;
    const parsedVip = vipPrice.trim() ? parseFloat(vipPrice) : null;
    const parsedVvip = vvipPrice.trim() ? parseFloat(vvipPrice) : null;
    // Named phase/row tiers
    const cleanExtra = extraTiers
      .map(t => ({ name: (t.name || '').trim(), price: (t.price || '').trim() }))
      .filter(t => t.name && t.price);

    const pricesList = [parsedEntry, parsedVip, parsedVvip, ...cleanExtra.map(t => parseFloat(t.price))]
      .filter(p => p !== null && !isNaN(p));
    if (pricesList.length > 0) {
      minP = Math.min(...pricesList);
      maxP = Math.max(...pricesList);
    }

    if (entryPrice.trim() || vipPrice.trim() || vvipPrice.trim() || cleanExtra.length) {
      const tiersObj = {};
      if (entryPrice.trim()) tiersObj.general = entryPrice.trim();
      if (vipPrice.trim()) tiersObj.vip = vipPrice.trim();
      if (vvipPrice.trim()) tiersObj.vvip = vvipPrice.trim();
      cleanExtra.forEach(t => { tiersObj[t.name] = t.price; });
      computedPrice = JSON.stringify(tiersObj);
    }

    payload.price = computedPrice;
    if (minP !== null) payload.price_min = minP;
    if (maxP !== null) payload.price_max = maxP;

    let insertError = null;
    const result = await resilient(
      [
        async () => {
          const { data, error } = await supabase.from('events').insert(payload).select().single();
          if (error) throw error;
          return data || true;
        },
        async () => {
          // Tier 2: strip columns that may not be migrated yet (coords/schedule/
          // categories/end_date/power_backup), keeping everything else.
          const { coords: _c, schedule: _s, categories: _cats, end_date: _ed, power_backup: _pb, secret_act: _sa, secret_reveal_threshold: _srt, tags: _tags, poster_mode: _pm, audience: _aud, ...safePayload } = payload;
          const { data, error } = await supabase.from('events').insert(safePayload).select().single();
          if (error) throw error;
          return data || true;
        },
        async () => {
          // Tier 3: minimum required fields — always keep category so feed filters work
          const minPayload = {
            title: payload.title,
            description: payload.description,
            author_id: payload.author_id,
            address: payload.address,
            event_date: payload.event_date,
            city: payload.city,
            lat: payload.lat,
            lon: payload.lon,
            price: payload.price,
            price_min: payload.price_min,
            price_max: payload.price_max,
            category: payload.category,   // MUST keep — drives all feed filters
            status: 'published',
          };
          const { data, error } = await supabase.from('events').insert(minPayload).select().single();
          if (error) throw error;
          return data || true;
        },
      ],
      {
        attemptsPerTier: 3, baseMs: 500, label: 'PostEventModal.insert',
        fallbackValue: null,
        onExhausted: async () => { insertError = new Error('All save attempts failed'); return null; },
      }
    );

    if (result !== null) {
      VibeEquityLedger.mintEquity(user.id, 'EVENT_HOSTING').catch(() => {});
      // Fire-and-forget: route the event to the right people.
      if (result !== true && result?.id) {
        import('../services/personalizationEngine').then(({ routeRecurringEvent, routeTargetedEvent, computeUserDeepProfile }) => {
          if (isRecurring) {
            computeUserDeepProfile(user.id).catch(() => {});
            routeRecurringEvent(result.id, { ...payload, id: result.id }).catch(() => {});
          }
          // Explicit audience targeting — deliver straight to matching people.
          if (payload.audience && Object.keys(payload.audience).length) {
            routeTargetedEvent(result.id, payload.audience, { lat: finalLat, lon: finalLon }).catch(() => {});
          }
        }).catch(() => {});
      }
      FeedManager.invalidate(result !== true && result?.id ? result.id : null);
      clearDraft();
      reset();
      if (result !== true && result?.id) onCreated?.(result);
      onPostSuccess?.();
      onClose();
    } else {
      const err = insertError || new Error('Could not save event');
      const msg = err.message || '';
      const fieldStepMap = {
        title: 1, description: 1, address: 1, city: 1, event_date: 1,
        category: 2, media: 2,
        ticket_url: 3, age_restriction: 3,
      };
      let targetStep = null;
      Object.entries(fieldStepMap).forEach(([col, s]) => {
        if (msg.includes(`"${col}"`)) targetStep = s;
      });
      let friendly = msg;
      if (msg.includes('author_id')) {
        friendly = 'You must be signed in to post. Tap your Vibe Card to sign in, then try again.';
      } else if (targetStep) {
        const fieldNames = { 1: 'title, description or address', 2: 'categories or media', 3: 'ticket link or age setting' };
        friendly = `Check your ${fieldNames[targetStep] || 'details'} — ${msg}`;
      }
      setError(friendly);
      if (targetStep && targetStep !== step) setStep(targetStep);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 350);
    }
    } finally {
      setLoading(false);
      setUploadingMedia(false);
    }
  };


  const buildAudiencePreview = () => {
    const csv = (s) => s.split(',').map(v => v.trim()).filter(Boolean);
    const a = {};
    if (ageMin > 0) a.age_min = ageMin;
    if (ageMax > 0) a.age_max = ageMax;
    if (audGenders.length) a.genders = audGenders;
    if (audTags.length) a.community_tags = audTags;
    if (audLanguages.length) a.languages = audLanguages;
    if (csv(audClans).length) a.clans = csv(audClans);
    if (csv(audSurnames).length) a.surnames = csv(audSurnames);
    if (csv(audCareers).length) a.careers = csv(audCareers);
    if (csv(audVillages).length) a.villages = csv(audVillages);
    if (audRadiusKm > 0) a.radius_km = audRadiusKm;
    return a;
  };

  const canProceedStep1 = posterMode
    ? title.trim().length > 2
    : title.trim().length > 2 && address.trim().length > 3;
  // Description is optional — a Gruv is droppable with just name + place + time
  // (poster mode needs only the flyer + title). Keeps posting friction near zero.

  const addScheduleItem = () => {
    if (!scheduleForm.time.trim() || !scheduleForm.title.trim()) return;
    setScheduleItems(prev => [
      ...prev,
      { id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, ...scheduleForm },
    ]);
    setScheduleForm({ time: '', title: '', performer: '', notes: '', day: 1 });
    setScheduleFormVisible(false);
  };

  const removeScheduleItem = (id) => setScheduleItems(prev => prev.filter(s => s.id !== id));

  const eventDays = (pickedDate && endDate)
    ? Math.max(1, Math.round((new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()) - new Date(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate())) / 86400000) + 1)
    : 1;

  const renderScheduleBuilder = () => (
    <View style={{ marginBottom: 20 }}>
      <View style={pm.sectionHeader}>
        <Text style={[pm.label, { color: muted, marginBottom: 0 }]}>Event Schedule</Text>
        <TouchableOpacity
          onPress={() => setScheduleFormVisible(v => !v)}
          style={[pm.addScheduleBtn, { borderColor: primary, backgroundColor: `${primary}12` }]}
        >
          <Feather name="plus" size={13} color={primary} />
          <Text style={{ color: primary, fontSize: 12, fontWeight: '800' }}>Add Slot</Text>
        </TouchableOpacity>
      </View>

      {scheduleItems.length > 0 && (
        <View style={{ gap: 8, marginBottom: 10 }}>
          {scheduleItems.map((item) => (
            <View key={item.id} style={[pm.scheduleRow, { borderColor: `${primary}30`, backgroundColor: `${primary}08` }]}>
              <View style={[pm.scheduleTimeBadge, { backgroundColor: `${primary}20` }]}>
                <Text style={[pm.scheduleTime, { color: primary }]}>{item.time}</Text>
              </View>
              <View style={{ flex: 1 }}>
                {eventDays > 1 && <Text style={{ color: primary, fontSize: 9, fontWeight: '900', letterSpacing: 0.5, marginBottom: 1 }}>DAY {item.day || 1}</Text>}
                <Text style={[pm.scheduleTitle, { color: textColor }]}>{item.title}</Text>
                {!!item.performer && <Text style={[pm.scheduleSub, { color: muted }]}>{item.performer}</Text>}
                {!!item.notes && <Text style={[pm.scheduleSub, { color: muted, fontStyle: 'italic' }]}>{item.notes}</Text>}
              </View>
              <TouchableOpacity onPress={() => removeScheduleItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={16} color={muted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {scheduleFormVisible && (
        <View style={[pm.scheduleForm, { borderColor: `${primary}30`, backgroundColor: `${primary}06` }]}>
          <Text style={[pm.scheduleFormTitle, { color: primary }]}>New Schedule Slot</Text>
          <View style={pm.scheduleRow2}>
            <TextInput
              style={[pm.scheduleInput, { color: textColor, borderColor: `${primary}35`, flex: 0.7 }]}
              placeholder="Time (e.g. 22:00)"
              placeholderTextColor={muted}
              value={scheduleForm.time}
              onChangeText={v => setScheduleForm(f => ({ ...f, time: v }))}
              maxLength={10}
            />
            <TextInput
              style={[pm.scheduleInput, { color: textColor, borderColor: `${primary}35`, flex: 1.3 }]}
              placeholder="Activity / Set title *"
              placeholderTextColor={muted}
              value={scheduleForm.title}
              onChangeText={v => setScheduleForm(f => ({ ...f, title: v }))}
              maxLength={60}
            />
          </View>
          <TextInput
            style={[pm.scheduleInput, { color: textColor, borderColor: `${primary}35` }]}
            placeholder="Performer / Artist (optional)"
            placeholderTextColor={muted}
            value={scheduleForm.performer}
            onChangeText={v => setScheduleForm(f => ({ ...f, performer: v }))}
            maxLength={60}
          />
          <TextInput
            style={[pm.scheduleInput, { color: textColor, borderColor: `${primary}35` }]}
            placeholder="Notes / details (optional)"
            placeholderTextColor={muted}
            value={scheduleForm.notes}
            onChangeText={v => setScheduleForm(f => ({ ...f, notes: v }))}
            maxLength={100}
          />
          {eventDays > 1 && (
            <View style={{ marginTop: 8 }}>
              <Text style={[pm.label, { color: muted, marginBottom: 6 }]}>Which day?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
                {Array.from({ length: eventDays }, (_, i) => i + 1).map(dn => {
                  const active = (scheduleForm.day || 1) === dn;
                  return (
                    <TouchableOpacity key={dn} onPress={() => setScheduleForm(f => ({ ...f, day: dn }))}
                      style={{ paddingHorizontal: 13, paddingVertical: 6, borderRadius: 14, borderWidth: 1, backgroundColor: active ? primary : `${primary}12`, borderColor: active ? primary : `${primary}30` }}>
                      <Text style={{ color: active ? '#000' : primary, fontWeight: '800', fontSize: 12 }}>Day {dn}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              style={[pm.scheduleConfirmBtn, { backgroundColor: scheduleForm.time && scheduleForm.title ? primary : `${primary}30`, flex: 1 }]}
              onPress={addScheduleItem}
              disabled={!scheduleForm.time.trim() || !scheduleForm.title.trim()}
            >
              <Feather name="check" size={14} color={scheduleForm.time && scheduleForm.title ? '#000' : muted} />
              <Text style={{ color: scheduleForm.time && scheduleForm.title ? '#000' : muted, fontWeight: '800', fontSize: 13 }}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[pm.scheduleConfirmBtn, { borderColor: `${primary}30`, borderWidth: 1, backgroundColor: 'transparent' }]}
              onPress={() => { setScheduleFormVisible(false); setScheduleForm({ time: '', title: '', performer: '', notes: '', day: 1 }); }}
            >
              <Text style={{ color: muted, fontWeight: '700', fontSize: 13 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {scheduleItems.length === 0 && !scheduleFormVisible && (
        <TouchableOpacity
          onPress={() => setScheduleFormVisible(true)}
          style={[pm.scheduleEmpty, { borderColor: `${primary}25` }]}
        >
          <Feather name="clock" size={18} color={`${primary}60`} />
          <Text style={{ color: muted, fontSize: 12, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
            Add a timeline — DJ sets, performances,{'\n'}speakers, activities, etc.
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderCategoryChips = () => {
    if (selectedCategories.length === 0) return null;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {selectedCategories.map(key => {
          const meta = ALL_CATEGORIES_MAP[key];
          const label = meta?.label || key.replace('custom_', '').replace(/_/g, ' ');
          const color = meta?.color || primary;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setSelectedCategories(prev => prev.filter(k => k !== key))}
              style={[pm.chip, { backgroundColor: `${color}20`, borderColor: `${color}50` }]}
            >
              <MaterialCommunityIcons name={meta?.icon || 'tag'} size={13} color={color} />
              <Text style={[pm.chipText, { color }]}>{label}</Text>
              <Feather name="x" size={11} color={color} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={pm.overlay}>
          <View style={[pm.sheet, { backgroundColor: bg, borderColor: `${primary}30` }]}>
            {/* Pill */}
            <View style={[pm.pill, { backgroundColor: `${primary}50` }]} />

            {/* Header */}
            <View style={pm.headerRow}>
              <View>
                <Text style={[pm.title, { color: primary }]}>NEW ROYAL VIBE</Text>
                <Text style={[pm.stepLabel, { color: muted }]}>Step {step} of 3</Text>
              </View>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={22} color={textColor} />
              </TouchableOpacity>
            </View>

            {/* Progress */}
            <View style={pm.progressBar}>
              <View style={[pm.progressFill, { backgroundColor: primary, width: `${(step / 3) * 100}%` }]} />
            </View>

            <ScrollView ref={scrollRef} style={pm.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* ── STEP 0: AI Fill — HIDDEN under development ─────────────────────────────────────── */}
              {/* {step === 0 && ( ... )} */}

              {/* ── STEP 1: Core info ────────────────────────────────────── */}
              {step === 1 && (
                <>
                  <Text style={[pm.label, { color: muted }]} onLayout={e => { fieldY.current.title = e.nativeEvent.layout.y; }}>Event Title *</Text>
                  <TextInput
                    ref={titleRef}
                    style={[pm.input, { color: textColor, borderColor: !title.trim() && error ? "#ef4444" : `${primary}35` }]}
                    placeholder="Give your event a name..."
                    placeholderTextColor={muted}
                    value={title}
                    onChangeText={v => { setTitle(v); if (error) setError(''); }}
                    maxLength={100}
                    returnKeyType="next"
                    onSubmitEditing={() => descriptionRef.current?.focus()}
                  />

                  {/* Poster mode — my poster already has all the details */}
                  <TouchableOpacity
                    onPress={() => { setPosterMode(v => !v); if (error) setError(''); }}
                    activeOpacity={0.85}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: posterMode ? primary : `${primary}30`, backgroundColor: posterMode ? `${primary}12` : `${primary}06` }}
                  >
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: posterMode ? primary : `${primary}50`, alignItems: 'center', justifyContent: 'center', backgroundColor: posterMode ? primary : 'transparent' }}>
                      {posterMode && <Feather name="check" size={12} color="#000" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: posterMode ? primary : textColor, fontWeight: '800', fontSize: 13 }}>My poster already has the details</Text>
                      <Text style={{ color: muted, fontSize: 11, marginTop: 1 }}>Skip the typing — just upload your flyer. We'll show it full-size.</Text>
                    </View>
                    <Feather name="image" size={16} color={posterMode ? primary : muted} />
                  </TouchableOpacity>

                  <Text style={[pm.label, { color: muted }]} onLayout={e => { fieldY.current.description = e.nativeEvent.layout.y; }}>{posterMode ? "What's the vibe? (optional)" : "What's the vibe? *"}</Text>
                  <TextInput
                    ref={descriptionRef}
                    style={[pm.input, pm.textarea, { color: textColor, borderColor: !posterMode && !description.trim() && error ? "#ef4444" : `${primary}35` }]}
                    placeholder={posterMode ? "Optional — the poster covers it, but you can add a line..." : "Describe your event — make it sound elite..."}
                    placeholderTextColor={muted}
                    multiline
                    numberOfLines={4}
                    value={description}
                    onChangeText={v => { setDescription(v); if (error) setError(''); }}
                    maxLength={600}
                  />
                  <Text style={[pm.charCount, { color: muted }]}>{description.length}/600</Text>

                  <Text style={[pm.label, { color: muted }]} onLayout={e => { fieldY.current.address = e.nativeEvent.layout.y; }}>{posterMode ? 'Venue / Address (optional)' : 'Venue / Address *'}</Text>
                  <TextInput
                    ref={addressRef}
                    style={[pm.input, { color: textColor, borderColor: !posterMode && !address.trim() && error ? "#ef4444" : `${primary}35` }]}
                    placeholder="Full address or venue name..."
                    placeholderTextColor={muted}
                    value={address}
                    onChangeText={handleAddressChange}
                    returnKeyType="done"
                  />

                  <TouchableOpacity
                    onPress={pinLocation}
                    style={[pm.catBtn, { marginBottom: 18, borderColor: lat ? "#10b981" : `${primary}40`, backgroundColor: lat ? '#10b98115' : `${primary}08` }]}
                  >
                    {geocoding
                      ? <ActivityIndicator size="small" color={primary} />
                      : <Feather name={lat ? "check-circle" : "map-pin"} size={16} color={lat ? "#10b981" : primary} />
                    }
                    <View style={{ flex: 1 }}>
                      <Text style={[{ color: lat ? "#10b981" : primary, fontWeight: '800', fontSize: 13 }]}>
                        {geocoding ? 'Finding coordinates…' : lat ? 'Location Found' : 'Pin Exact Spot (GPS)'}
                      </Text>
                      {lat && !geocoding && <Text style={{ color: "#10b981", fontSize: 10 }}>{lat.toFixed(5)}, {lon.toFixed(5)}</Text>}
                      {!lat && !geocoding && <Text style={{ color: muted, fontSize: 10 }}>Auto-detected from address · tap to use GPS</Text>}
                    </View>
                  </TouchableOpacity>

                  <Text style={[pm.label, { color: muted }]}>City</Text>
                  <TextInput
                    style={[pm.input, { color: textColor, borderColor: `${primary}35` }]}
                    placeholder="e.g. Johannesburg, Cape Town..."
                    placeholderTextColor={muted}
                    value={city}
                    onChangeText={setCity}
                  />

                  <Text style={[pm.label, { color: muted }]}>Power during load-shedding</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                    {[
                      { key: 'grid', label: 'Grid only', icon: 'zap-off' },
                      { key: 'generator', label: 'Generator', icon: 'zap' },
                      { key: 'solar', label: 'Solar', icon: 'sun' },
                      { key: 'ups', label: 'UPS / Inverter', icon: 'battery-charging' },
                    ].map((o) => {
                      const active = powerBackup === o.key;
                      return (
                        <TouchableOpacity key={o.key} onPress={() => setPowerBackup(active ? null : o.key)} activeOpacity={0.8}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: active ? primary : `${primary}30`, backgroundColor: active ? `${primary}20` : 'transparent' }}>
                          <Feather name={o.icon} size={12} color={active ? primary : muted} />
                          <Text style={{ color: active ? primary : muted, fontSize: 12, fontWeight: '700' }}>{o.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[pm.label, { color: muted }]}>Good to know (accessibility · safety · vibe)</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {EVENT_TAGS.map((t) => {
                      const active = eventTags.includes(t.key);
                      return (
                        <TouchableOpacity key={t.key} activeOpacity={0.8} onPress={() => setEventTags((prev) => active ? prev.filter((k) => k !== t.key) : [...prev, t.key])}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: active ? t.color : `${primary}25`, backgroundColor: active ? `${t.color}22` : 'transparent' }}>
                          <Text style={{ fontSize: 12 }}>{t.emoji}</Text>
                          <Text style={{ color: active ? t.color : muted, fontSize: 11, fontWeight: '700' }}>{t.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[pm.label, { color: muted, marginBottom: 0 }]}>Secret headliner (optional)</Text>
                    <TouchableOpacity onPress={() => setShowSecretHelpText(prev => !prev)} style={{ padding: 4 }} activeOpacity={0.7}>
                      <Feather name="help-circle" size={14} color={primary} />
                    </TouchableOpacity>
                  </View>

                  {showSecretHelpText && (
                    <View style={{
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderColor: `${primary}35`,
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 12,
                      marginTop: 4,
                      marginBottom: 10,
                      gap: 6,
                    }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>💡 Secret Headliner Examples:</Text>
                      <Text style={{ color: muted, fontSize: 11, lineHeight: 16 }}>
                        Keep surprise features hidden on the event page until your RSVPs reach a target threshold!
                      </Text>
                      <View style={{ gap: 4, marginTop: 4 }}>
                        <Text style={{ color: primary, fontSize: 11 }}>• "Surprise Guest DJ Set" (unlocked at 50 RSVPs)</Text>
                        <Text style={{ color: primary, fontSize: 11 }}>• "Secret Venue Address Details" (unlocked at 75 RSVPs)</Text>
                        <Text style={{ color: primary, fontSize: 11 }}>• "Free Cocktail Voucher Code" (unlocked at 30 RSVPs)</Text>
                      </View>
                    </View>
                  )}

                  <TextInput
                    style={[pm.input, { color: textColor, borderColor: `${primary}35` }]}
                    placeholder="Hidden act — unlocks when RSVPs hit a target"
                    placeholderTextColor={muted}
                    value={secretAct}
                    onChangeText={setSecretAct}
                  />
                  {secretAct.trim().length > 0 && (
                    <TextInput
                      style={[pm.input, { color: textColor, borderColor: `${primary}35` }]}
                      placeholder="Reveal at how many RSVPs? (default 25)"
                      placeholderTextColor={muted}
                      value={revealThreshold}
                      onChangeText={(t) => setRevealThreshold(t.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric"
                    />
                  )}

                  <Text style={[pm.label, { color: muted }]}>Contact Number (Optional)</Text>
                  <TextInput
                    style={[pm.input, { color: textColor, borderColor: `${primary}35` }]}
                    placeholder="e.g. +27 82 000 0000"
                    placeholderTextColor={muted}
                    value={contactPhone}
                    onChangeText={setContactPhone}
                    keyboardType="phone-pad"
                  />

                  <Text style={[pm.label, { color: muted }]}>Contact Email (Optional)</Text>
                  <TextInput
                    style={[pm.input, { color: textColor, borderColor: `${primary}35` }]}
                    placeholder="e.g. organizer@email.com"
                    placeholderTextColor={muted}
                    value={contactEmail}
                    onChangeText={setContactEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <Text ref={dateRef} style={[pm.label, { color: muted }]} onLayout={e => { fieldY.current.date = e.nativeEvent.layout.y; }}>Date & Time *</Text>
                  <View style={pm.pickerRow}>
                    {/* Date picker button */}
                    <TouchableOpacity
                      style={[pm.pickerBtn, { borderColor: pickedDate ? primary : `${primary}35`, backgroundColor: pickedDate ? `${primary}12` : 'rgba(255,255,255,0.05)', flex: 1.4 }]}
                      onPress={() => setCalendarVisible(true)}
                    >
                      <Feather name="calendar" size={15} color={pickedDate ? primary : muted} />
                      <Text style={[pm.pickerBtnText, { color: pickedDate ? primary : muted }]} numberOfLines={1}>
                        {pickedDate
                          ? pickedDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Pick date'}
                      </Text>
                    </TouchableOpacity>

                    {/* Start time picker */}
                    <TouchableOpacity
                      style={[pm.pickerBtn, { borderColor: timeSet ? primary : `${primary}35`, backgroundColor: timeSet ? `${primary}12` : 'rgba(255,255,255,0.05)', flex: 1 }]}
                      onPress={() => setTimePickerVisible(true)}
                    >
                      <Feather name="clock" size={15} color={timeSet ? primary : muted} />
                      <Text style={[pm.pickerBtnText, { color: timeSet ? primary : muted }]}>
                        {timeSet
                          ? `${String(pickedHour).padStart(2, '0')}:${String(pickedMinute).padStart(2, '0')}`
                          : 'Start'}
                      </Text>
                    </TouchableOpacity>

                    {/* End time picker */}
                    <TouchableOpacity
                      style={[pm.pickerBtn, { borderColor: endTimeSet ? primary : `${primary}25`, backgroundColor: endTimeSet ? `${primary}12` : 'rgba(255,255,255,0.03)', flex: 1 }]}
                      onPress={() => setEndTimePickerVisible(true)}
                    >
                      <Feather name="clock" size={15} color={endTimeSet ? primary : muted} />
                      <Text style={[pm.pickerBtnText, { color: endTimeSet ? primary : muted }]}>
                        {endTimeSet && endHour !== null
                          ? `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
                          : 'End (opt)'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Optional end date — multi-day events (tournaments, festivals) */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      style={[pm.pickerBtn, { borderColor: endDate ? primary : `${primary}25`, backgroundColor: endDate ? `${primary}12` : 'rgba(255,255,255,0.03)', flex: 1 }]}
                      onPress={() => setEndCalendarVisible(true)}
                    >
                      <Feather name="calendar" size={15} color={endDate ? primary : muted} />
                      <Text style={[pm.pickerBtnText, { color: endDate ? primary : muted }]} numberOfLines={1}>
                        {endDate
                          ? `Ends ${endDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : 'End date — optional, for multi-day events'}
                      </Text>
                    </TouchableOpacity>
                    {endDate && (
                      <TouchableOpacity onPress={() => setEndDate(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Feather name="x" size={16} color={muted} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* ── Recurrence toggle ──────────────────────────────────── */}
                  <TouchableOpacity
                    onPress={() => setIsRecurring(v => !v)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: isRecurring ? primary : `${primary}30`, backgroundColor: isRecurring ? `${primary}12` : `${primary}06` }}
                  >
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isRecurring ? primary : `${primary}50`, alignItems: 'center', justifyContent: 'center', backgroundColor: isRecurring ? primary : 'transparent' }}>
                      {isRecurring && <Feather name="check" size={12} color="#000" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: isRecurring ? primary : textColor, fontWeight: '800', fontSize: 13 }}>Recurring Event</Text>
                      <Text style={{ color: muted, fontSize: 11, marginTop: 1 }}>Weekly, monthly, annually or custom dates</Text>
                    </View>
                    <Feather name="repeat" size={16} color={isRecurring ? primary : muted} />
                  </TouchableOpacity>

                  {isRecurring && (
                    <View style={{ marginBottom: 16, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: `${primary}25`, backgroundColor: `${primary}06` }}>
                      {/* Type selector */}
                      <Text style={[pm.label, { color: muted, marginBottom: 8 }]}>Repeat Type</Text>
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                        {['weekly', 'monthly', 'annually', 'custom'].map(t => (
                          <TouchableOpacity
                            key={t}
                            onPress={() => setRecurrenceType(t)}
                            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: recurrenceType === t ? primary : `${primary}30`, backgroundColor: recurrenceType === t ? `${primary}20` : 'transparent' }}
                          >
                            <Text style={{ color: recurrenceType === t ? primary : muted, fontWeight: '800', fontSize: 12, textTransform: 'capitalize' }}>{t}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Weekly: day-of-week selector */}
                      {recurrenceType === 'weekly' && (
                        <>
                          <Text style={[pm.label, { color: muted, marginBottom: 8 }]}>Repeat on</Text>
                          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
                            {['S','M','T','W','T','F','S'].map((d, i) => {
                              const active = recurrenceDays.includes(i);
                              return (
                                <TouchableOpacity
                                  key={i}
                                  onPress={() => setRecurrenceDays(prev => active ? prev.filter(x => x !== i) : [...prev, i])}
                                  style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: active ? primary : `${primary}30`, backgroundColor: active ? `${primary}25` : 'transparent' }}
                                >
                                  <Text style={{ color: active ? primary : muted, fontWeight: '800', fontSize: 12 }}>{d}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          <Text style={[pm.label, { color: muted, marginBottom: 8 }]}>Every</Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                            {[1, 2, 3, 4].map(n => (
                              <TouchableOpacity
                                key={n}
                                onPress={() => setRecurrenceInterval(n)}
                                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: recurrenceInterval === n ? primary : `${primary}30`, backgroundColor: recurrenceInterval === n ? `${primary}20` : 'transparent' }}
                              >
                                <Text style={{ color: recurrenceInterval === n ? primary : muted, fontWeight: '800', fontSize: 12 }}>{n === 1 ? 'Week' : `${n} Wks`}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}

                      {/* Monthly: interval selector */}
                      {recurrenceType === 'monthly' && (
                        <>
                          <Text style={[pm.label, { color: muted, marginBottom: 8 }]}>Every</Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                            {[1, 2, 3, 6].map(n => (
                              <TouchableOpacity
                                key={n}
                                onPress={() => setRecurrenceInterval(n)}
                                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: recurrenceInterval === n ? primary : `${primary}30`, backgroundColor: recurrenceInterval === n ? `${primary}20` : 'transparent' }}
                              >
                                <Text style={{ color: recurrenceInterval === n ? primary : muted, fontWeight: '800', fontSize: 12 }}>{n === 1 ? 'Month' : `${n} Months`}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}

                      {/* Custom: list of dates */}
                      {recurrenceType === 'custom' && (
                        <>
                          <Text style={[pm.label, { color: muted, marginBottom: 8 }]}>Event Dates ({customDates.length})</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                            {customDates.map((d, i) => (
                              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: `${primary}20`, borderWidth: 1, borderColor: `${primary}40` }}>
                                <Text style={{ color: primary, fontWeight: '700', fontSize: 12 }}>
                                  {d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </Text>
                                <TouchableOpacity onPress={() => setCustomDates(prev => prev.filter((_, j) => j !== i))}>
                                  <Feather name="x" size={11} color={primary} />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                          <TouchableOpacity
                            onPress={() => setCustomDateCalendarVisible(true)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: `${primary}40`, backgroundColor: `${primary}08`, marginBottom: 10 }}
                          >
                            <Feather name="plus" size={14} color={primary} />
                            <Text style={{ color: primary, fontWeight: '800', fontSize: 12 }}>Add Date</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {/* End date (all non-custom types) */}
                      {recurrenceType !== 'custom' && (
                        <>
                          <Text style={[pm.label, { color: muted, marginBottom: 8 }]}>Series End Date (Optional)</Text>
                          <TouchableOpacity
                            onPress={() => setRecurrenceEndCalendarVisible(true)}
                            style={[pm.pickerBtn, { borderColor: recurrenceEndDate ? primary : `${primary}30`, backgroundColor: recurrenceEndDate ? `${primary}12` : 'transparent', alignSelf: 'flex-start', marginBottom: 0 }]}
                          >
                            <Feather name="calendar" size={14} color={recurrenceEndDate ? primary : muted} />
                            <Text style={[pm.pickerBtnText, { color: recurrenceEndDate ? primary : muted }]}>
                              {recurrenceEndDate
                                ? recurrenceEndDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
                                : 'No end date'}
                            </Text>
                            {recurrenceEndDate && (
                              <TouchableOpacity onPress={() => setRecurrenceEndDate(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Feather name="x" size={12} color={muted} />
                              </TouchableOpacity>
                            )}
                          </TouchableOpacity>
                        </>
                      )}

                      {/* Summary pill */}
                      <View style={{ marginTop: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: `${primary}15`, alignSelf: 'flex-start' }}>
                        <Text style={{ color: primary, fontWeight: '700', fontSize: 11 }}>
                          {recurrenceType === 'custom'
                            ? `${customDates.length} date${customDates.length !== 1 ? 's' : ''} set`
                            : recurrenceType === 'weekly'
                              ? `Every ${recurrenceInterval === 1 ? '' : recurrenceInterval + ' '}week${recurrenceInterval > 1 ? 's' : ''}${recurrenceDays.length > 0 ? ' on ' + recurrenceDays.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ') : ''}${recurrenceEndDate ? ' until ' + recurrenceEndDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}`
                              : recurrenceType === 'monthly'
                                ? `Every ${recurrenceInterval === 1 ? 'month' : recurrenceInterval + ' months'}${recurrenceEndDate ? ' until ' + recurrenceEndDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}`
                                : 'Every year on this date'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {!!error && <View style={pm.errorBox}><Text style={pm.errorText}>⚠️ {error}</Text></View>}

                  <TouchableOpacity
                    style={[pm.nextBtn, { backgroundColor: canProceedStep1 ? primary : `${primary}20` }]}
                    onPress={() => {
                      if (!title.trim()) {
                        setError('Event title is required — give your Gruv a name.');
                        scrollAndFocus('title', titleRef);
                        return;
                      }
                      if (!posterMode && !description.trim()) {
                        setError('Describe the vibe — what makes this Gruv special?');
                        scrollAndFocus('description', descriptionRef);
                        return;
                      }
                      if (!posterMode && !address.trim()) {
                        setError('Venue / address is required so people know where to show up.');
                        scrollAndFocus('address', addressRef);
                        return;
                      }
                      setError(''); setStep(2);
                    }}
                  >
                    <Text style={{ color: canProceedStep1 ? '#000' : muted, fontWeight: '900', fontSize: 15 }}>NEXT →</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* ── STEP 2: Media & categories ───────────────────────────── */}
              {step === 2 && (
                <>
                  {/* Media */}
                  <View style={pm.sectionHeader}>
                    <Text style={[pm.label, { color: posterMode ? primary : muted, marginBottom: 0 }]}>
                      {posterMode ? `Poster ${mediaItems.length > 0 ? '✓' : '*'} (${mediaItems.length}/${MAX_MEDIA})` : `Media (${mediaItems.length}/${MAX_MEDIA})`}
                    </Text>
                    <Text style={[{ color: muted, fontSize: 11 }]}>Photos & Videos</Text>
                  </View>
                  {posterMode && mediaItems.length === 0 && (
                    <Text style={{ color: muted, fontSize: 12, marginBottom: 10, lineHeight: 17 }}>
                      Upload your flyer/poster here — it carries all the details and shows full-size on your event card.
                    </Text>
                  )}

                  {/* Media thumbnails */}
                  {mediaItems.length > 0 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginBottom: 12 }}
                      contentContainerStyle={{ gap: 8 }}
                    >
                      {mediaItems.map((item, idx) => (
                        <View key={idx} style={pm.thumbWrap}>
                          <Image source={{ uri: item.uri }} style={pm.thumb} resizeMode="cover" />
                          {item.type === 'video' && (
                            <View style={pm.videoOverlay}>
                              <Feather name="play" size={16} color="#fff" />
                            </View>
                          )}
                          <TouchableOpacity style={[pm.removeBtn, { backgroundColor: "#ef4444" }]} onPress={() => removeMedia(idx)}>
                            <Feather name="x" size={10} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  <TouchableOpacity
                    style={[pm.mediaPickBtn, { borderColor: `${primary}40`, backgroundColor: `${primary}08` }]}
                    onPress={pickMedia}
                    disabled={mediaItems.length >= MAX_MEDIA}
                  >
                    <Feather name="image" size={20} color={mediaItems.length >= MAX_MEDIA ? muted : primary} />
                    <Text style={[pm.mediaPickText, { color: mediaItems.length >= MAX_MEDIA ? muted : primary }]}>
                      {mediaItems.length === 0
                        ? `Add Photos & Videos (up to ${MAX_MEDIA})`
                        : `Add more (${MAX_MEDIA - mediaItems.length} left)`}
                    </Text>
                  </TouchableOpacity>

                  {/* Schedule */}
                  {renderScheduleBuilder()}

                  {/* Competition / league link (unlocks governance + predictions) */}
                  <CompetitionPicker value={competitionId} onChange={setCompetitionId} sportType={selectedCategories[0] || null} />

                  {/* Categories */}
                  <Text style={[pm.label, { color: muted, marginTop: 4 }]}>Categories & Interests</Text>
                  {renderCategoryChips()}
                  <TouchableOpacity
                    style={[pm.catBtn, { borderColor: `${primary}40`, backgroundColor: `${primary}08` }]}
                    onPress={() => setCatPickerVisible(true)}
                  >
                    <Feather name="tag" size={16} color={primary} />
                    <Text style={[{ color: primary, fontWeight: '800', fontSize: 13 }]}>
                      {selectedCategories.length > 0
                        ? `${selectedCategories.length} selected — tap to change`
                        : 'Pick from 1000+ categories'}
                    </Text>
                    <Feather name="chevron-right" size={16} color={`${primary}80`} style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>

                  {/* Event type */}
                  <Text style={[pm.label, { color: muted, marginTop: 20 }]}>Event Format</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                    {EVENT_TYPES.map(t => (
                      <TouchableOpacity
                        key={t}
                        onPress={() => setEventType(t === eventType ? '' : t)}
                        style={[pm.tag, { backgroundColor: eventType === t ? primary : `${primary}10`, borderColor: eventType === t ? primary : `${primary}20` }]}
                      >
                        <Text style={{ color: eventType === t ? '#000' : textColor, fontSize: 12, fontWeight: '700' }}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {!!error && <View style={pm.errorBox}><Text style={pm.errorText}>⚠️ {error}</Text></View>}

                  <View style={pm.bottomRow}>
                    <TouchableOpacity style={pm.backBtn} onPress={() => setStep(1)}>
                      <Feather name="arrow-left" size={14} color={muted} />
                      <Text style={[pm.backText, { color: muted }]}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[pm.postBtn, { backgroundColor: primary }]}
                      onPress={() => { setError(''); setStep(3); }}
                    >
                      <Text style={pm.postBtnText}>NEXT →</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* ── STEP 3: Settings & publish ───────────────────────────── */}
              {step === 3 && (
                <>
                  <Text style={[pm.label, { color: muted }]}>Ticket / RSVP Link</Text>
                  <TextInput
                    style={[pm.input, { color: textColor, borderColor: `${primary}35` }]}
                    placeholder="https://tickets.example.com..."
                    placeholderTextColor={muted}
                    value={ticketUrl}
                    onChangeText={setTicketUrl}
                    autoCapitalize="none"
                    keyboardType="url"
                  />

                  <Text style={[pm.label, { color: muted }]}>Age Range</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[{ color: muted, fontSize: 10, fontWeight: '800', marginBottom: 5 }]}>MIN AGE</Text>
                      <View style={[pm.ageRow, { flexWrap: 'wrap' }]}>
                        {AGE_MIN_OPTIONS.map(a => (
                          <TouchableOpacity
                            key={a}
                            onPress={() => setAgeMin(a)}
                            style={[pm.ageBtn, { backgroundColor: ageMin === a ? primary : `${primary}10`, borderColor: ageMin === a ? primary : `${primary}20` }]}
                          >
                            <Text style={{ color: ageMin === a ? '#000' : textColor, fontWeight: '800', fontSize: 11 }}>
                              {a === 0 ? 'Any' : `${a}+`}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[{ color: muted, fontSize: 10, fontWeight: '800', marginBottom: 5 }]}>MAX AGE</Text>
                    <View style={[pm.ageRow, { flexWrap: 'wrap' }]}>
                      {AGE_MAX_OPTIONS.map(a => (
                        <TouchableOpacity
                          key={a}
                          onPress={() => setAgeMax(a)}
                          style={[pm.ageBtn, { backgroundColor: ageMax === a ? primary : `${primary}10`, borderColor: ageMax === a ? primary : `${primary}20` }]}
                        >
                          <Text style={{ color: ageMax === a ? '#000' : textColor, fontWeight: '800', fontSize: 11 }}>
                            {a === 0 ? 'No limit' : a === 99 ? '99+' : `≤${a}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: muted, fontSize: 10, fontWeight: '800', marginBottom: 5 }}>OR TYPE CUSTOM MIN AGE</Text>
                      <TextInput
                        style={[pm.input, { color: textColor, borderColor: `${primary}35`, fontSize: 12, height: 38, paddingVertical: 6 }]}
                        placeholder="e.g. 18"
                        placeholderTextColor={muted}
                        value={ageMin > 0 ? String(ageMin) : ''}
                        onChangeText={(t) => setAgeMin(parseInt(t.replace(/[^0-9]/g, '')) || 0)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: muted, fontSize: 10, fontWeight: '800', marginBottom: 5 }}>OR TYPE CUSTOM MAX AGE</Text>
                      <TextInput
                        style={[pm.input, { color: textColor, borderColor: `${primary}35`, fontSize: 12, height: 38, paddingVertical: 6 }]}
                        placeholder="e.g. 45"
                        placeholderTextColor={muted}
                        value={ageMax > 0 ? String(ageMax) : ''}
                        onChangeText={(t) => setAgeMax(parseInt(t.replace(/[^0-9]/g, '')) || 0)}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  {ageMin > 0 && (
                    <Text style={{ color: primary, fontSize: 11, fontWeight: '800', marginTop: 4, marginBottom: 12 }}>
                      Allowed: {ageMin}{ageMax > 0 ? `–${ageMax === 99 ? '99+' : ageMax}` : '+'}
                    </Text>
                  )}

                  {/* ── Audience targeting ── who exactly is this Gruv for? ── */}
                  <TouchableOpacity
                    onPress={() => setShowTargeting(v => !v)}
                    activeOpacity={0.85}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, marginBottom: showTargeting ? 14 : 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: hasAudienceTargeting(buildAudiencePreview()) ? primary : `${primary}30`, backgroundColor: hasAudienceTargeting(buildAudiencePreview()) ? `${primary}12` : `${primary}06` }}
                  >
                    <Feather name="target" size={16} color={primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textColor, fontWeight: '800', fontSize: 13 }}>Who is this for?</Text>
                      <Text style={{ color: muted, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                        {describeAudience(buildAudiencePreview())} — tap to {showTargeting ? 'collapse' : 'target'}
                      </Text>
                    </View>
                    <Feather name={showTargeting ? 'chevron-up' : 'chevron-down'} size={18} color={muted} />
                  </TouchableOpacity>

                  {showTargeting && (
                    <View style={{ marginBottom: 18, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: `${primary}25`, backgroundColor: `${primary}06` }}>
                      <Text style={{ color: muted, fontSize: 11, lineHeight: 16, marginBottom: 14 }}>
                        Leave it all blank to reach everyone. Anything you pick delivers this Gruv straight to matching people's feeds. We only ever match what users chose to share on their own profile.
                      </Text>

                      <Text style={[pm.label, { color: muted }]}>Gender</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                        {GENDER_OPTIONS.map(g => {
                          const active = audGenders.includes(g.key);
                          return (
                            <TouchableOpacity key={g.key} activeOpacity={0.8}
                              onPress={() => setAudGenders(prev => active ? prev.filter(k => k !== g.key) : [...prev, g.key])}
                              style={[pm.targetChip, { borderColor: active ? primary : `${primary}30`, backgroundColor: active ? `${primary}20` : 'transparent' }]}>
                              <Text style={{ fontSize: 12 }}>{g.emoji}</Text>
                              <Text style={{ color: active ? primary : muted, fontSize: 12, fontWeight: '700' }}>{g.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {Object.entries(COMMUNITY_TAG_GROUPS).map(([group, tags]) => (
                        <View key={group} style={{ marginBottom: 14 }}>
                          <Text style={[pm.label, { color: muted }]}>{group}</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {tags.map(t => {
                              const active = audTags.includes(t.key);
                              return (
                                <TouchableOpacity key={t.key} activeOpacity={0.8}
                                  onPress={() => setAudTags(prev => active ? prev.filter(k => k !== t.key) : [...prev, t.key])}
                                  style={[pm.targetChip, { borderColor: active ? primary : `${primary}30`, backgroundColor: active ? `${primary}20` : 'transparent' }]}>
                                  <Text style={{ fontSize: 12 }}>{t.emoji}</Text>
                                  <Text style={{ color: active ? primary : muted, fontSize: 11, fontWeight: '700' }}>{t.label}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      ))}

                      <Text style={[pm.label, { color: muted }]}>Language</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                        {LANGUAGE_OPTIONS.map(l => {
                          const active = audLanguages.includes(l.key);
                          return (
                            <TouchableOpacity key={l.key} activeOpacity={0.8}
                              onPress={() => setAudLanguages(prev => active ? prev.filter(k => k !== l.key) : [...prev, l.key])}
                              style={[pm.targetChip, { borderColor: active ? primary : `${primary}30`, backgroundColor: active ? `${primary}20` : 'transparent' }]}>
                              <Text style={{ color: active ? primary : muted, fontSize: 11, fontWeight: '700' }}>{l.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <Text style={[pm.label, { color: muted }]}>Clan name(s) — isiduko</Text>
                      <TextInput
                        style={[pm.input, { color: textColor, borderColor: `${primary}35`, marginBottom: 12 }]}
                        placeholder="e.g. Mthethwa, Dlamini (comma-separated)"
                        placeholderTextColor={muted}
                        value={audClans}
                        onChangeText={setAudClans}
                      />
                      <Text style={[pm.label, { color: muted }]}>Surname(s)</Text>
                      <TextInput
                        style={[pm.input, { color: textColor, borderColor: `${primary}35`, marginBottom: 12 }]}
                        placeholder="e.g. Nkwali (comma-separated)"
                        placeholderTextColor={muted}
                        value={audSurnames}
                        onChangeText={setAudSurnames}
                      />
                      <Text style={[pm.label, { color: muted }]}>Professions — invite by career</Text>
                      <TextInput
                        style={[pm.input, { color: textColor, borderColor: `${primary}35`, marginBottom: 12 }]}
                        placeholder="e.g. Model, DJ, Event Planner (comma-separated)"
                        placeholderTextColor={muted}
                        value={audCareers}
                        onChangeText={setAudCareers}
                      />
                      <Text style={[pm.label, { color: muted }]}>Home village / area</Text>
                      <TextInput
                        style={[pm.input, { color: textColor, borderColor: `${primary}35`, marginBottom: 12 }]}
                        placeholder="e.g. Qunu, Soweto (comma-separated)"
                        placeholderTextColor={muted}
                        value={audVillages}
                        onChangeText={setAudVillages}
                      />

                      <Text style={[pm.label, { color: muted }]}>Distance from venue</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                        {[0, 5, 20, 50, 100].map(r => {
                          const active = audRadiusKm === r;
                          return (
                            <TouchableOpacity key={r} onPress={() => setAudRadiusKm(r)}
                              style={[pm.targetChip, { borderColor: active ? primary : `${primary}30`, backgroundColor: active ? `${primary}20` : 'transparent' }]}>
                              <Text style={{ color: active ? primary : muted, fontSize: 12, fontWeight: '800' }}>{r === 0 ? 'Anywhere' : `${r}km`}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <TouchableOpacity onPress={() => setAudMatchAll(v => !v)} activeOpacity={0.8}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: audMatchAll ? primary : `${primary}50`, alignItems: 'center', justifyContent: 'center', backgroundColor: audMatchAll ? primary : 'transparent' }}>
                          {audMatchAll && <Feather name="check" size={12} color="#000" />}
                        </View>
                        <Text style={{ color: muted, fontSize: 12, flex: 1 }}>
                          {audMatchAll ? 'Must match ALL of the above (strict)' : 'Match ANY of the above (wider reach)'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <Text style={[pm.label, { color: muted, marginTop: 12 }]}>Ticket Prices & Entry (Optional)</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[{ color: muted, fontSize: 10, fontWeight: '800', marginBottom: 5 }]}>ENTRY / GEN (R)</Text>
                      <TextInput
                        style={[pm.input, { color: textColor, borderColor: `${primary}35`, fontSize: 13, height: 40, paddingVertical: 8 }]}
                        placeholder="e.g. 150"
                        placeholderTextColor={muted}
                        value={entryPrice}
                        onChangeText={setEntryPrice}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[{ color: muted, fontSize: 10, fontWeight: '800', marginBottom: 5 }]}>VIP (R)</Text>
                      <TextInput
                        style={[pm.input, { color: textColor, borderColor: `${primary}35`, fontSize: 13, height: 40, paddingVertical: 8 }]}
                        placeholder="e.g. 350"
                        placeholderTextColor={muted}
                        value={vipPrice}
                        onChangeText={setVipPrice}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[{ color: muted, fontSize: 10, fontWeight: '800', marginBottom: 5 }]}>VVIP (R)</Text>
                      <TextInput
                        style={[pm.input, { color: textColor, borderColor: `${primary}35`, fontSize: 13, height: 40, paddingVertical: 8 }]}
                        placeholder="e.g. 600"
                        placeholderTextColor={muted}
                        value={vvipPrice}
                        onChangeText={setVvipPrice}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <Text style={[{ color: muted, fontSize: 10, fontWeight: '800', marginBottom: 5 }]}>PHASES, ROWS / ZONES & CUSTOM TIERS (Optional)</Text>
                  {/* Preset chips — add a named tier in one tap */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {['Early Bird', 'Phase 1', 'Phase 2', 'Phase 3', 'Golden Circle', 'Standing', 'Seated', 'Table', 'Row A', 'Group'].map(preset => (
                      <TouchableOpacity
                        key={preset}
                        onPress={() => setExtraTiers(prev => prev.some(t => t.name === preset) ? prev : [...prev, { name: preset, price: '' }])}
                        style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: `${primary}30`, backgroundColor: `${primary}0C` }}
                      >
                        <Text style={{ color: primary, fontSize: 11, fontWeight: '800' }}>+ {preset}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {extraTiers.map((t, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <TextInput
                        style={[pm.input, { flex: 1.4, color: textColor, borderColor: `${primary}35`, fontSize: 13, height: 40, paddingVertical: 8 }]}
                        placeholder="Tier name (e.g. Phase 2 / Golden Circle)"
                        placeholderTextColor={muted}
                        value={t.name}
                        onChangeText={v => setExtraTiers(prev => prev.map((x, j) => j === i ? { ...x, name: v } : x))}
                      />
                      <TextInput
                        style={[pm.input, { flex: 1, color: textColor, borderColor: `${primary}35`, fontSize: 13, height: 40, paddingVertical: 8 }]}
                        placeholder="Price (R)"
                        placeholderTextColor={muted}
                        value={t.price}
                        onChangeText={v => setExtraTiers(prev => prev.map((x, j) => j === i ? { ...x, price: v.replace(/[^0-9.]/g, '') } : x))}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity onPress={() => setExtraTiers(prev => prev.filter((_, j) => j !== i))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Feather name="x-circle" size={20} color={muted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    onPress={() => setExtraTiers(prev => [...prev, { name: '', price: '' }])}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 18, paddingVertical: 6 }}
                  >
                    <Feather name="plus-circle" size={16} color={primary} />
                    <Text style={{ color: primary, fontSize: 12, fontWeight: '800' }}>Add ticket tier</Text>
                  </TouchableOpacity>

                  {/* Summary card */}
                  <GlassView style={[pm.summary, { borderColor: `${primary}20` }]}>
                    <Text style={[pm.summaryTitle, { color: primary }]}>Event Summary</Text>
                    <Text style={[pm.summaryLine, { color: textColor }]}>📛 {title}</Text>
                    <Text style={[pm.summaryLine, { color: muted }]}>📍 {address}{city ? `, ${city}` : ''}</Text>
                    {pickedDate ? (
                      <Text style={[pm.summaryLine, { color: muted }]}>
                        📅 {pickedDate.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        {timeSet ? ` ${String(pickedHour).padStart(2, '0')}:${String(pickedMinute).padStart(2, '0')}` : ''}
                        {endTimeSet && endHour !== null ? ` – ${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}` : ''}
                      </Text>
                    ) : null}
                    {entryPrice || vipPrice || vvipPrice || otherTickets ? (
                      <Text style={[pm.summaryLine, { color: muted }]}>
                        🎟️ {entryPrice ? `Gen: ${money(entryPrice)} ` : ''}
                        {vipPrice ? `VIP: ${money(vipPrice)} ` : ''}
                        {vvipPrice ? `VVIP: ${money(vvipPrice)} ` : ''}
                        {otherTickets ? `(${otherTickets})` : ''}
                      </Text>
                    ) : (
                      <Text style={[pm.summaryLine, { color: muted }]}>🎟️ FREE entry</Text>
                    )}
                    {ageMin > 0 && (
                      <Text style={[pm.summaryLine, { color: muted }]}>
                        🔞 Ages {ageMin}{ageMax > 0 ? `–${ageMax === 99 ? '99+' : ageMax}` : '+'}
                      </Text>
                    )}
                    {hasAudienceTargeting(buildAudiencePreview()) && (
                      <Text style={[pm.summaryLine, { color: muted }]}>
                        🎯 {describeAudience(buildAudiencePreview())}
                      </Text>
                    )}
                    {selectedCategories.length > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <MaterialCommunityIcons name="tag-multiple" size={12} color={muted} />
                        <Text style={[pm.summaryLine, { color: muted }]}>
                          {selectedCategories.slice(0, 5).map(k => ALL_CATEGORIES_MAP[k]?.label || k).join(', ')}
                          {selectedCategories.length > 5 ? ` +${selectedCategories.length - 5} more` : ''}
                        </Text>
                      </View>
                    )}
                    {mediaItems.length > 0 && (
                      <View style={{ marginTop: 6 }}>
                        <Text style={[pm.summaryLine, { color: muted }]}>
                          🖼️ {mediaItems.length} media item{mediaItems.length !== 1 ? 's' : ''}
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 6 }}>
                          {mediaItems.slice(0, 10).map((item, idx) => (
                            <View key={idx} style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: `${primary}30` }}>
                              <Image source={{ uri: item.uri }} style={{ width: 56, height: 56 }} resizeMode="cover" />
                              {item.type === 'video' && (
                                <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
                                  <Feather name="play" size={14} color="#fff" />
                                </View>
                              )}
                            </View>
                          ))}
                          {mediaItems.length > 10 && (
                            <View style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: `${primary}15`, alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ color: primary, fontWeight: '900', fontSize: 13 }}>+{mediaItems.length - 10}</Text>
                            </View>
                          )}
                        </ScrollView>
                      </View>
                    )}
                    {scheduleItems.length > 0 && (
                      <Text style={[pm.summaryLine, { color: muted }]}>
                        🗓️ {scheduleItems.length} schedule slot{scheduleItems.length !== 1 ? 's' : ''}
                        {' — '}{scheduleItems.map(s => s.time).join(', ')}
                      </Text>
                    )}
                  </GlassView>

                  {uploadingMedia && (
                    <View style={pm.uploadProgress}>
                      <ActivityIndicator color={primary} size="small" />
                      <Text style={[{ color: muted, fontSize: 12, marginLeft: 8 }]}>Uploading media...</Text>
                    </View>
                  )}

                  {!!error && <View style={pm.errorBox}><Text style={pm.errorText}>⚠️ {error}</Text></View>}

                  <View style={pm.bottomRow}>
                    <TouchableOpacity style={pm.backBtn} onPress={() => setStep(2)}>
                      <Feather name="arrow-left" size={14} color={muted} />
                      <Text style={[pm.backText, { color: muted }]}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[pm.postBtn, { backgroundColor: primary }, loading && pm.disabled]}
                      onPress={handlePost}
                      disabled={loading}
                    >
                      {loading
                        ? <ActivityIndicator color="#000" />
                        : <Text style={pm.postBtnText}>ANNOUNCE EVENT 👑</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Category picker */}
      <CategoryPickerModal
        visible={catPickerVisible}
        onClose={() => setCatPickerVisible(false)}
        selected={selectedCategories}
        onConfirm={setSelectedCategories}
        title="Event Categories"
      />

      {/* Date picker */}
      <CalendarPicker
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        onConfirm={(date) => {
          setPickedDate(date);
          setCalendarVisible(false);
          if (endDate && date > endDate) {
            setError('Start date cannot be after end date.');
            setEndDate(null);
          } else {
            setError('');
          }
        }}
        value={pickedDate}
        primary={primary} bg={bg} textColor={textColor} muted={muted}
      />

      <CalendarPicker
        visible={endCalendarVisible}
        onClose={() => setEndCalendarVisible(false)}
        onConfirm={(date) => {
          if (pickedDate && date < pickedDate) {
            setError('End date cannot be before start date.');
          } else {
            setEndDate(date);
            setError('');
          }
          setEndCalendarVisible(false);
        }}
        value={endDate}
        primary={primary} bg={bg} textColor={textColor} muted={muted}
      />

      {/* Time picker */}
      <TimePicker
        visible={timePickerVisible}
        onClose={() => setTimePickerVisible(false)}
        onConfirm={(h, m) => { setPickedHour(h); setPickedMinute(m); setTimeSet(true); setTimePickerVisible(false); }}
        initialHour={pickedHour}
        initialMinute={pickedMinute}
        primary={primary} bg={bg} textColor={textColor} muted={muted}
      />

      <TimePicker
        visible={endTimePickerVisible}
        onClose={() => setEndTimePickerVisible(false)}
        onConfirm={(h, m) => { setEndHour(h); setEndMinute(m); setEndTimeSet(true); setEndTimePickerVisible(false); }}
        initialHour={endHour ?? pickedHour}
        initialMinute={endMinute ?? 0}
        primary={primary} bg={bg} textColor={textColor} muted={muted}
      />

      {/* Recurrence end date calendar */}
      <CalendarPicker
        visible={recurrenceEndCalendarVisible}
        onClose={() => setRecurrenceEndCalendarVisible(false)}
        onConfirm={(date) => { setRecurrenceEndDate(date); setRecurrenceEndCalendarVisible(false); }}
        value={recurrenceEndDate}
        minDate={pickedDate || new Date()}
        primary={primary} bg={bg} textColor={textColor} muted={muted}
      />

      {/* Custom dates calendar — adds to list on each confirm */}
      <CalendarPicker
        visible={customDateCalendarVisible}
        onClose={() => setCustomDateCalendarVisible(false)}
        onConfirm={(date) => {
          setCustomDates(prev => {
            const key = date.toISOString().split('T')[0];
            const alreadyHas = prev.some(d => d.toISOString().split('T')[0] === key);
            return alreadyHas ? prev : [...prev, date].sort((a, b) => a - b);
          });
          setCustomDateCalendarVisible(false);
        }}
        value={null}
        minDate={new Date()}
        primary={primary} bg={bg} textColor={textColor} muted={muted}
      />
    </>
  );
};

const pm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.78)' },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, paddingHorizontal: 22, paddingBottom: 10, maxHeight: '94%',
  },
  pill: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  stepLabel: { fontSize: 11, marginTop: 3 },
  progressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginBottom: 22, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  form: { flex: 1 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  input: {
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 15, paddingVertical: 13,
    fontSize: 14, marginBottom: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  textarea: { height: 110, textAlignVertical: 'top' },
  charCount: { fontSize: 10, textAlign: 'right', marginTop: -14, marginBottom: 16 },

  // Media
  thumbWrap: { position: 'relative', width: 90, height: 90 },
  thumb: { width: 90, height: 90, borderRadius: 12, backgroundColor: "#1a1a1a" },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  removeBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  mediaPickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 18, marginBottom: 4,
  },
  mediaPickText: { fontWeight: '800', fontSize: 13 },

  // Categories
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, marginRight: 8,
  },
  chipText: { fontSize: 12, fontWeight: '800' },
  catBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
  },

  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  targetChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14, borderWidth: 1 },
  ageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  ageBtn: { flex: 1, minWidth: SCREEN_W < 375 ? 45 : 60, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1 },

  // Summary
  summary: { borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, gap: 6 },
  summaryTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  summaryLine: { fontSize: 13, lineHeight: 20 },

  uploadProgress: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },

  pickerRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 13,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pickerBtnText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  nextBtn: { paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginTop: 10, marginBottom: 10 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 16, paddingHorizontal: 10 },
  backText: { fontSize: 15, fontWeight: '700' },
  postBtn: { flex: 1, paddingVertical: 16, borderRadius: 30, alignItems: 'center' },
  postBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  disabled: { opacity: 0.6 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 10,
    padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  errorText: { color: "#ef4444", fontSize: 12, fontWeight: '600' },

  // Schedule builder
  addScheduleBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  scheduleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  scheduleTimeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, minWidth: 50, alignItems: 'center' },
  scheduleTime: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  scheduleTitle: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  scheduleSub: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  scheduleForm: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10, marginBottom: 10 },
  scheduleFormTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  scheduleRow2: { flexDirection: SCREEN_W < 375 ? 'column' : 'row', gap: 8 },
  scheduleInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, backgroundColor: 'rgba(255,255,255,0.05)' },
  scheduleConfirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 30 },
  scheduleEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
