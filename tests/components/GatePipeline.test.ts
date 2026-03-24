import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import GatePipeline from '../../src/components/gate/GatePipeline.vue';

// GateType values used throughout
type GateType = 'G0' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6';

const allGateTypes: GateType[] = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'];

function emptyPipeline(): Record<GateType, { status: string } | null> {
  return { G0: null, G1: null, G2: null, G3: null, G4: null, G5: null, G6: null };
}

describe('GatePipeline', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders a button node for every gate type', () => {
    const wrapper = mount(GatePipeline, {
      props: { pipeline: emptyPipeline() },
    });

    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(allGateTypes.length);
  });

  it('displays the correct label for each gate', () => {
    const wrapper = mount(GatePipeline, {
      props: { pipeline: emptyPipeline() },
    });

    const expectedLabels = ['需求確認', '圖稿審核', '程式碼審查', '測試驗收', '文件審查', '部署就緒', '正式發佈'];
    const text = wrapper.text();

    expectedLabels.forEach((label) => {
      expect(text).toContain(label);
    });
  });

  it('shows gate type identifiers (G0–G6) inside the nodes', () => {
    const wrapper = mount(GatePipeline, {
      props: { pipeline: emptyPipeline() },
    });

    allGateTypes.forEach((type) => {
      expect(wrapper.text()).toContain(type);
    });
  });

  it('applies pending status colour classes for a pending gate', () => {
    // Component only renders gates with non-null status, so provide a full pipeline
    const pipeline = {
      G0: { status: 'approved' },
      G1: { status: 'pending' },
      G2: { status: 'pending' },
      G3: { status: 'pending' },
      G4: { status: 'pending' },
      G5: { status: 'pending' },
      G6: { status: 'pending' },
    };

    const wrapper = mount(GatePipeline, {
      props: { pipeline },
    });

    // G1 button should carry the pending background class
    const buttons = wrapper.findAll('button');
    const g1Button = buttons[1]; // G1 is the second gate
    expect(g1Button.classes()).toContain('bg-yellow-500/20');
    expect(g1Button.classes()).toContain('border-yellow-500');
  });

  it('applies approved status colour classes for an approved gate', () => {
    const pipeline = {
      G0: { status: 'approved' },
      G1: { status: 'pending' },
      G2: { status: 'pending' },
      G3: { status: 'pending' },
      G4: { status: 'pending' },
      G5: { status: 'pending' },
      G6: { status: 'pending' },
    };

    const wrapper = mount(GatePipeline, {
      props: { pipeline },
    });

    const g0Button = wrapper.findAll('button')[0];
    expect(g0Button.classes()).toContain('bg-emerald-500/20');
    expect(g0Button.classes()).toContain('border-emerald-500');
  });

  it('emits a select event with the gate type when a gate button is clicked', async () => {
    // Provide a full pipeline so all 7 buttons render
    const fullPipeline = {
      G0: { status: 'pending' }, G1: { status: 'pending' }, G2: { status: 'pending' },
      G3: { status: 'pending' }, G4: { status: 'pending' }, G5: { status: 'pending' },
      G6: { status: 'pending' },
    };
    const wrapper = mount(GatePipeline, {
      props: { pipeline: fullPipeline },
    });

    const buttons = wrapper.findAll('button');
    // Use native click to avoid happy-dom SupportedEventInterface issue
    buttons[2].element.click();
    await wrapper.vm.$nextTick();

    const emitted = wrapper.emitted('select');
    expect(emitted).toBeTruthy();
    expect(emitted![0]).toEqual(['G2']);
  });

  it('applies ring highlight classes when a gate is selected', () => {
    const fullPipeline = {
      G0: { status: 'pending' }, G1: { status: 'pending' }, G2: { status: 'pending' },
      G3: { status: 'pending' }, G4: { status: 'pending' }, G5: { status: 'pending' },
      G6: { status: 'pending' },
    };
    const wrapper = mount(GatePipeline, {
      props: { pipeline: fullPipeline, selectedGate: 'G3' as GateType },
    });

    const buttons = wrapper.findAll('button');
    const g3Button = buttons[3]; // G3 is the fourth gate
    expect(g3Button.classes()).toContain('ring-2');
    expect(g3Button.classes()).toContain('ring-accent');
  });
});
